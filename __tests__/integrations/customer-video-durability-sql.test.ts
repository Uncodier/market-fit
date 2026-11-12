/** @jest-environment node */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const bin = '/opt/homebrew/opt/postgresql@17/bin';
const site = '11111111-1111-4111-8111-111111111111';
const connection = '22222222-2222-4222-8222-222222222222';
const seed = { id: '33333333-3333-4333-8333-333333333333', eventId: '44444444-4444-4444-8444-444444444444',
  siteId: site, routing: { payer: 'customer', siteId: site, connectionId: connection, policyVersion: 2, credentialVersion: 3 },
  request: { model: 'vendor/video', prompt: 'Garden', duration: 4, aspect_ratio: '16:9' },
  fingerprint: 'a'.repeat(64), operationKey: 'video:test', status: 'pending', createdAt: '2026-11-12T00:00:00Z' };
const settlement = { status: 'completed', receipt: { site_id: site, connection_id: connection,
  policy_version: 2, credential_version: 3, event_id: seed.eventId, capability: 'video',
  generation_id: 'gen-1', model: null, state: 'completed', usage_evidence: { gateway_account_cost: 2 } } };
const sqlSave = (job: object) => `SELECT public.openrouter_customer_video_save('${JSON.stringify(job)}'::jsonb)`;
const migration = (name: string) => readFileSync(path.join(process.cwd(), 'supabase/migrations', name), 'utf8');

(existsSync(path.join(bin, 'initdb')) ? describe : describe.skip)('video durability on isolated PostgreSQL with independent sessions', () => {
  let directory: string;
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C' };
  const args = () => ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55447', '-U', 'postgres', '-d', 'postgres'];
  const db = (sql: string) => execFileSync(path.join(bin, 'psql'), [...args(), '-c', sql], { env, encoding: 'utf8', stdio: 'pipe' }).trim();
  const save = (job: object) => JSON.parse(db(sqlSave(job)));
  const load = () => JSON.parse(db(`SELECT public.openrouter_customer_video_load('${site}','${seed.id}',null)`));
  const asyncDb = (sql: string) => new Promise<{ code: number | null; stderr: string }>(resolve => {
    const child = spawn(path.join(bin, 'psql'), [...args(), '-c', sql], { env });
    let stderr = ''; child.stderr.on('data', value => { stderr += value; });
    child.on('close', code => resolve({ code, stderr }));
  });
  const waitFor = async (query: string) => {
    for (let i = 0; i < 100; i++) {
      if (db(query) === 't') return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Concurrent SQL barrier timed out');
  };
  beforeAll(() => {
    directory = mkdtempSync('/tmp/video-cas-pg-');
    execFileSync(path.join(bin, 'initdb'), ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale'], { env, stdio: 'pipe' });
    execFileSync(path.join(bin, 'pg_ctl'), ['-D', `${directory}/data`, '-l', `${directory}/server.log`, '-o',
      `-F -p 55447 -k ${directory} -c listen_addresses=''`, '-w', 'start'], { env, stdio: 'pipe' });
    db(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.sites(id uuid PRIMARY KEY);
      CREATE TABLE public.openrouter_customer_connections(id uuid PRIMARY KEY, site_id uuid NOT NULL);
      INSERT INTO public.sites VALUES ('${site}');
      INSERT INTO public.openrouter_customer_connections VALUES ('${connection}','${site}');`);
    db(migration('20261112060000_openrouter_customer_video_jobs.sql'));
    db(`CREATE TABLE public.openrouter_customer_policies(connection_id uuid, policy_version integer, credential_version integer);
      INSERT INTO public.openrouter_customer_policies VALUES ('${connection}',2,3);
      CREATE TABLE public.openrouter_customer_receipts(site_id uuid,connection_id uuid,event_id uuid,receipt jsonb,
        PRIMARY KEY(site_id,connection_id,event_id));`);
    const receipts = migration('20261112010000_openrouter_customer_connections.sql');
    db(receipts.slice(receipts.indexOf('CREATE FUNCTION public.openrouter_customer_receipt(p_receipt'), receipts.indexOf('REVOKE ALL ON FUNCTION')));
    // Upgrade a real versionless accepted job, preserving its checkpoint.
    save(seed); save({ ...seed, upstreamId: 'provider-1', status: 'in_progress', cost: 2 });
    db(migration('20261112072000_openrouter_customer_video_durability.sql'));
  }, 30000);
  afterAll(() => {
    if (!directory) return;
    if (existsSync(`${directory}/data/postmaster.pid`)) execFileSync(path.join(bin, 'pg_ctl'),
      ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop'], { env, stdio: 'pipe' });
    rmSync(directory, { recursive: true, force: true });
  });
  it('upgrades a versionless checkpoint without dropping its provider cost', () => {
    expect(load()).toMatchObject({ upstreamId: 'provider-1', cost: 2 });
    expect(save(load()).version).toBe(0);
    const updated = save({ ...load(), generationId: 'gen-1' });
    expect(updated.version).toBe(1);
    expect(updated.cost).toBe(2);
  });
  it('rejects serialized stale nonterminal writes, not just terminal overwrites', () => {
    const stale = load();
    const saved = save({ ...stale, settlement, videos: [{ url: 'https://storage.example.test/v.mp4', mimeType: 'video/mp4' }] });
    expect(() => save({ ...stale, error: 'stale' })).toThrow('Video stale version');
    expect(load()).toEqual(saved);
    expect(save({ ...saved, version: stale.version })).toEqual(saved); // lost ACK exact retry
  });
  it('rejects checkpoint removal even with the current version', () => {
    const job = load();
    for (const field of ['cost', 'videos', 'settlement', 'generationId', 'upstreamId']) {
      const changed = { ...job }; delete changed[field];
      expect(() => save(changed)).toThrow();
    }
    expect(() => save({ ...job, cost: 5 })).toThrow('Video settlement evidence conflict');
    expect(() => save({ ...job, status: 'pending' })).toThrow('Video status regression');
  });
  it('has one winner when two sessions read the same revision and overlap updates', async () => {
    const job = load();
    const first = asyncDb(`SET application_name='video-writer-a'; BEGIN; ${sqlSave({ ...job, error: 'winner' })}; SELECT pg_sleep(1.5); COMMIT;`);
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='video-writer-a' AND wait_event='PgSleep')");
    const second = asyncDb(`SET application_name='video-writer-b'; ${sqlSave({ ...job, error: 'stale loser' })}`);
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='video-writer-b' AND wait_event_type='Lock')");
    expect((await first).code).toBe(0);
    expect(await second).toMatchObject({ code: 1, stderr: expect.stringContaining('Video stale version') });
    expect(load()).toMatchObject({ error: 'winner', cost: 2, settlement, videos: job.videos, version: job.version + 1 });
  });
  it('does not allow two different jobs for a concurrent first operation', async () => {
    const job = { ...seed, id: '55555555-5555-4555-8555-555555555555', operationKey: 'video:race' };
    const first = asyncDb(`SET application_name='video-insert-a'; BEGIN; ${sqlSave(job)}; SELECT pg_sleep(1.5); COMMIT;`);
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='video-insert-a' AND wait_event='PgSleep')");
    const second = asyncDb(`SET application_name='video-insert-b'; ${sqlSave({ ...job, id: seed.eventId })}`);
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='video-insert-b' AND wait_event_type='Lock')");
    expect((await first).code).toBe(0);
    expect((await second).code).toBe(1);
    expect(db("SELECT count(*) FROM public.openrouter_customer_video_jobs WHERE operation_key='video:race'")).toBe('1');
  });
  it('keeps terminal results immutable and tenant scoped', () => {
    const completed = save({ ...load(), status: 'completed' });
    expect(save(completed)).toEqual(completed);
    expect(() => save({ ...completed, status: 'in_progress' })).toThrow('Video outcome conflict');
    expect(db(`SELECT public.openrouter_customer_video_load('${connection}','${seed.id}',null) IS NULL`)).toBe('t');
  });
  it('grants RPC access only to service role, never direct writes or client roles', () => {
    for (const role of ['anon', 'authenticated']) expect(() => db(`SET ROLE ${role}; ${sqlSave(seed)}`)).toThrow('permission denied');
    expect(() => db('SET ROLE service_role; DELETE FROM public.openrouter_customer_video_jobs')).toThrow('permission denied');
    expect(JSON.parse(db(`SET ROLE service_role; SELECT public.openrouter_customer_video_load('${site}','${seed.id}',null)`)).status).toBe('completed');
  });
  it('replays the actual SQL receipt after accepted-but-lost ACK and rejects differing evidence', () => {
    const receipt = load().settlement.receipt;
    const deliver = (value: object) => db(`SELECT public.openrouter_customer_receipt('${JSON.stringify(value)}'::jsonb)`);
    deliver(receipt); // Commit succeeds, caller loses the ACK.
    deliver(load().settlement.receipt);
    expect(() => deliver({ ...receipt, usage_evidence: { gateway_account_cost: 9 } })).toThrow('Receipt conflict');
    expect(db('SELECT count(*) FROM public.openrouter_customer_receipts')).toBe('1');
    expect(JSON.parse(db('SELECT receipt FROM public.openrouter_customer_receipts'))).toEqual(receipt);
  });
  it('serializes two independent deliveries of the same exact receipt', async () => {
    db('TRUNCATE public.openrouter_customer_receipts');
    const sql = `SELECT public.openrouter_customer_receipt('${JSON.stringify(load().settlement.receipt)}'::jsonb)`;
    const first = asyncDb(`SET application_name='receipt-a'; BEGIN; ${sql}; SELECT pg_sleep(1.5); COMMIT;`);
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='receipt-a' AND wait_event='PgSleep')");
    const second = asyncDb(`SET application_name='receipt-b'; ${sql}`);
    await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='receipt-b' AND wait_event_type='Lock')");
    expect((await first).code).toBe(0); expect((await second).code).toBe(0);
    expect(db('SELECT count(*) FROM public.openrouter_customer_receipts')).toBe('1');
  });
});