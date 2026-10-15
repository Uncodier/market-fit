/** @jest-environment node */
import { createHash, randomBytes } from 'node:crypto';
import { MarketplaceDatabase, id, integration, location, normalizedOrder, operator, owner,
  postgresAvailable, site } from './database-harness';

const suite = postgresAvailable ? describe : describe.skip;
const opaque = () => randomBytes(48).toString('base64');
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex');
const sqlJson = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'`;
suite('durable marketplace merchant consent in isolated socket-only PostgreSQL', () => {
  const db = new MarketplaceDatabase();
  beforeAll(() => { db.start(); db.createRoles(); });
  afterAll(() => db.stop());
  beforeEach(() => db.reset());
  function begin(context: Record<string, unknown> = {}, actor = owner) {
    const stateHash = digest(), encryptedContext = opaque();
    const session = JSON.parse(db.actor(`SELECT begin_marketplace_oauth(${sqlJson({
      site_id: site, provider: 'uber_eats', environment: 'sandbox', country: 'US', credential_mode: 'platform', ...context,
    })},'${stateHash}','${encryptedContext}','${actor}')`, actor));
    return { session, stateHash, encryptedContext };
  }
  const claim = (stateHash: string, actor = owner, provider = 'uber_eats') => JSON.parse(db.actor(
    `SELECT claim_marketplace_oauth('${stateHash}','${provider}','${actor}')`, actor));
  function complete(sessionId: string, stores: object[] = [{ id: 'store-test', name: 'Synthetic store' }], actor = owner) {
    const encryptedAuthorization = opaque(), appHash = digest();
    const result = JSON.parse(db.actor(`SELECT complete_marketplace_oauth('${sessionId}','${encryptedAuthorization}',
      now()+interval '1 hour','${appHash}','${actor}',${sqlJson(stores)})`, actor));
    return { connectionId: result.connection_id, encryptedAuthorization, appHash };
  }
  function connection(context: Record<string, unknown> = {}, stores?: object[]) {
    const started = begin(context); claim(started.stateHash, owner, String(context.provider || 'uber_eats'));
    return { ...started, ...complete(started.session.id, stores) };
  }
  function save(connectionId: string, overrides: Record<string, unknown> = {}) {
    return JSON.parse(db.actor(`SELECT save_marketplace_integration(${sqlJson({
      id: integration, site_id: site, provider: 'uber_eats', environment: 'sandbox', country: 'US',
      external_store_id: 'store-test', origin_location_id: location, credential_mode: 'platform',
      merchant_connection_id: connectionId, enabled: true, ...overrides,
    })},NULL,NULL,'${owner}')`));
  }
  const provision = (operation = 'activate', actor = owner) => JSON.parse(db.actor(
    `SELECT claim_marketplace_provisioning('${integration}','${operation}','${actor}')`, actor));
  const finish = (batchId: string, result = 'confirmed', providerBatch: string | null = null, actor = owner) => JSON.parse(db.actor(
    `SELECT finish_marketplace_provisioning('${integration}','${batchId}','${result}','${actor}',
    ${providerBatch === null ? 'NULL' : `'${providerBatch}'`})`, actor));

  it('uses SHA256-only unique state and cipher-only verifier context with no browser grants', () => {
    const started = begin();
    expect(started.session.state_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(started.session.encrypted_context).toBe(started.encryptedContext);
    expect(started.session.user_id).toBe(owner); expect(started.session.status).toBe('created');
    expect(() => db.actor(`SELECT begin_marketplace_oauth(${sqlJson({ site_id: site, provider: 'uber_eats' })},
      'plaintext-state','${opaque()}','${owner}')`)).toThrow();
    const consentTables = ['marketplace_platform_apps', 'marketplace_oauth_sessions',
      'marketplace_merchant_connections', 'marketplace_provider_webhook_keys', 'marketplace_webhook_registrations',
      'marketplace_webhook_registration_apps'];
    for (const table of consentTables) {
      for (const role of ['anon', 'authenticated']) {
        expect(() => db.actor(`SELECT * FROM ${table}`, owner, role)).toThrow('permission denied');
        expect(() => db.actor(`DELETE FROM ${table}`, owner, role)).toThrow('permission denied');
        expect(db.sql(`SELECT has_table_privilege('${role}','${table}','INSERT,UPDATE,DELETE,SELECT')`)).toBe('f');
      }
    }
    expect(() => db.actor(`SELECT claim_marketplace_oauth('${started.stateHash}','uber_eats','${owner}')`, owner,
      'authenticated')).toThrow('permission denied');
    expect(() => db.actor(`INSERT INTO marketplace_oauth_sessions SELECT * FROM marketplace_oauth_sessions`)).toThrow('duplicate key');
  });

  it('rejects cross-actor/provider/site and suspended manager before claiming, preserving the valid state', () => {
    const started = begin();
    for (const actor of [operator, id(3), id(5)]) expect(() => claim(started.stateHash, actor)).toThrow('state unavailable');
    expect(() => claim(started.stateHash, owner, 'rappi')).toThrow('state unavailable');
    expect(() => begin({ site_id: id(11) })).toThrow('insufficient site permission');
    expect(() => begin({}, operator)).toThrow('insufficient site permission');
    expect(() => begin({}, id(5))).toThrow('insufficient site permission');
    db.sql(`UPDATE sites SET archived_at=now() WHERE id='${site}'`);
    expect(() => claim(started.stateHash)).toThrow('insufficient site permission');
    expect(db.sql(`SELECT status FROM marketplace_oauth_sessions WHERE id='${started.session.id}'`)).toBe('created');
    db.sql(`UPDATE sites SET archived_at=NULL WHERE id='${site}'`);
    expect(claim(started.stateHash).status).toBe('claimed');
  });

  it('rejects expired/failed states, never replaying after claim or changing immutable bindings', () => {
    const expired = begin({ expires_at: new Date(Date.now() + 1000).toISOString() });
    db.sql('SELECT pg_sleep(1.1)');
    expect(() => claim(expired.stateHash)).toThrow('state unavailable');
    const started = begin(); claim(started.stateHash);
    expect(() => claim(started.stateHash)).toThrow('state unavailable');
    expect(() => db.actor(`UPDATE marketplace_oauth_sessions SET site_id='${id(11)}' WHERE id='${started.session.id}'`))
      .toThrow('identity or lifecycle is immutable');
    db.actor(`SELECT fail_marketplace_oauth('${started.session.id}','${owner}')`);
    expect(db.sql(`SELECT status||':'||(encrypted_context IS NULL)::text FROM marketplace_oauth_sessions
      WHERE id='${started.session.id}'`)).toBe('failed:true');
    expect(() => claim(started.stateHash)).toThrow('state unavailable');
    expect(() => complete(started.session.id)).toThrow('claim unavailable');
    expect(() => db.actor(`UPDATE marketplace_oauth_sessions SET status='created',encrypted_context='${opaque()}'
      WHERE id='${started.session.id}'`)).toThrow('identity or lifecycle is immutable');
  });

  it('serializes concurrent state consumption and creates exactly one actor-bound encrypted connection', async () => {
    const started = begin();
    const statement = `SET ROLE service_role; SELECT claim_marketplace_oauth('${started.stateHash}','uber_eats','${owner}')`;
    const results = await Promise.allSettled([db.concurrent(statement), db.concurrent(statement)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(() => complete(started.session.id, [], id(3))).toThrow('claim unavailable');
    const completed = complete(started.session.id);
    expect(db.sql('SELECT count(*) FROM marketplace_merchant_connections')).toBe('1');
    expect(db.sql('SELECT encrypted_authorization FROM marketplace_merchant_connections')).toBe(completed.encryptedAuthorization);
    expect(db.sql('SELECT status FROM marketplace_oauth_sessions')).toBe('completed');
    expect(db.sql('SELECT encrypted_context IS NULL FROM marketplace_oauth_sessions')).toBe('t');
    expect(() => complete(started.session.id)).toThrow('claim unavailable');
    expect(() => db.actor(`UPDATE marketplace_merchant_connections SET actor_user_id='${id(3)}'`)).toThrow('identity is immutable');
  });

  it('preserves legacy custom native secrets while platform stores bind only to consent-listed stores', () => {
    db.configure(); expect(db.sql('SELECT credential_mode FROM marketplace_integrations')).toBe('custom');
    expect(db.sql('SELECT secret_id IS NOT NULL FROM marketplace_integrations')).toBe('t');
    const connected = connection({}, [{ id: 'store-test-3' }]);
    const platformId = id(31);
    expect(() => save(connected.connectionId, { id: platformId, external_store_id: 'store-test-2' }))
      .toThrow('authorization mismatch');
    expect(() => save(connected.connectionId, { id: platformId })).toThrow('authorization mismatch');
    const saved = save(connected.connectionId, { id: platformId, external_store_id: 'store-test-3' });
    expect(saved.secret_id).toBeNull(); expect(saved.enabled).toBe(false);
    expect(db.sql('SELECT count(*) FROM site_secrets')).toBe('1');
  });

  it('rejects missing/cross-tenant/provider/environment/country/mode/store consent and per-site platform copies', () => {
    const connected = connection();
    for (const overrides of [
      { merchant_connection_id: id(999) }, { site_id: id(11), origin_location_id: id(21) },
      { provider: 'rappi', country: 'MX' }, { environment: 'production' }, { country: 'CA' },
      { external_store_id: 'not-authorized' }, { credential_mode: 'custom' },
    ]) expect(() => save(connected.connectionId, overrides)).toThrow();
    expect(db.sql('SELECT count(*) FROM marketplace_integrations')).toBe('0');
    expect(db.sql('SELECT count(*) FROM site_secrets')).toBe('0');
    const saved = save(connected.connectionId, { provisioning_status: 'active' });
    expect(saved.enabled).toBe(false); expect(saved.provisioning_status).toBe('not_ready');
    expect(saved.secret_id).toBeNull();
    const visible = db.actor('SELECT row_to_json(i) FROM marketplace_integrations i', owner, 'authenticated');
    for (const sensitive of [connected.encryptedAuthorization, connected.appHash, connected.encryptedContext]) {
      expect(visible).not.toContain(sensitive);
    }
    expect(db.actor('SELECT count(*) FROM marketplace_integrations', id(3), 'authenticated')).toBe('0');
    const newConnection = connection();
    expect(() => save(newConnection.connectionId)).toThrow('identity is immutable');
    expect(() => db.actor(`UPDATE marketplace_integrations SET credential_mode='custom'`)).toThrow('identity is immutable');
  });

  it('durably claims activation once, allows early orders but blocks actions/poll until provider confirmation', async () => {
    const connected = connection(); save(connected.connectionId);
    const claimed = provision(); expect(claimed.duplicate).toBe(false);
    expect(claimed.integration.provisioning_status).toBe('pending');
    expect(provision().duplicate).toBe(true);
    const imported = db.ingest(normalizedOrder());
    expect(() => db.actor(`SELECT claim_marketplace_action('${imported.order_id}','accept','${operator}')`))
      .toThrow('not active');
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll()'))).toEqual([]);
    finish(claimed.batch_id, 'unknown');
    expect(finish(claimed.batch_id, 'failed').provisioning_status).toBe('pending');
    expect(provision().duplicate).toBe(true);
    expect(() => finish(id(888))).toThrow('claim unavailable');
    expect(() => finish(claimed.batch_id, 'confirmed', null, operator)).toThrow('insufficient site permission');
    const active = finish(claimed.batch_id);
    expect(active.provisioning_status).toBe('active'); expect(active.enabled).toBe(true);
    expect(save(connected.connectionId).provisioning_status).toBe('active');
    expect(finish(claimed.batch_id, 'failed').provisioning_status).toBe('active');
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll()'))).toHaveLength(1);
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_action('${imported.order_id}','accept','${operator}')`)).duplicate).toBe(false);
  });

  it('persists provider batch identities and reconciles only signed-server event outcomes with matching operation', () => {
    const connected = connection({ provider: 'rappi', country: 'MX' });
    save(connected.connectionId, { provider: 'rappi', country: 'MX' });
    const claimed = provision();
    finish(claimed.batch_id, 'pending', 'batch-synthetic');
    expect(() => finish(claimed.batch_id, 'pending', 'other-batch')).toThrow('identity is immutable');
    const reconcile = (batch: string, status = 'active') => JSON.parse(db.actor(
      `SELECT reconcile_marketplace_provisioning('${integration}','${batch}','${status}')`));
    expect(() => reconcile('wrong-batch')).toThrow('identity mismatch');
    expect(() => reconcile('batch-synthetic', 'revoked')).toThrow('operation mismatch');
    expect(() => db.actor(`SELECT reconcile_marketplace_provisioning('${integration}','batch-synthetic','active')`, owner,
      'authenticated')).toThrow('permission denied');
    expect(reconcile('batch-synthetic').provisioning_status).toBe('active');
    const deactivation = provision('deactivate');
    finish(deactivation.batch_id, 'unknown');
    expect(provision('deactivate').duplicate).toBe(true);
    expect(finish(deactivation.batch_id).enabled).toBe(false);
    db.actor(`SELECT revoke_marketplace_merchant_connection('${connected.connectionId}','${owner}')`);
    expect(db.sql('SELECT status FROM marketplace_merchant_connections')).toBe('revoked');
    expect(db.sql('SELECT encrypted_authorization IS NULL FROM marketplace_merchant_connections')).toBe('t');
    expect(() => provision()).toThrow('authorization unavailable');
    expect(() => save(connected.connectionId, { provider: 'rappi', country: 'MX', enabled: true }))
      .toThrow('authorization mismatch');
    expect(() => db.actor(`UPDATE marketplace_merchant_connections SET status='authorized',encrypted_authorization='${opaque()}'`))
      .toThrow('identity is immutable');
  });

  it('keeps global per-event webhook keys immutable, app-bound, unique and unreadable in tenant queries', () => {
    const connected = connection(); save(connected.connectionId);
    const keyA = opaque(), keyB = opaque();
    const insert = (event: string, ciphertext: string, appHash = connected.appHash, integrationId: string | null = null) => db.actor(
      `INSERT INTO marketplace_provider_webhook_keys(app_client_id_hash,provider,environment,country,integration_id,event,secret_ciphertext)
      VALUES('${appHash}','uber_eats','sandbox',NULL,${integrationId ? `'${integrationId}'` : 'NULL'},'${event}','${ciphertext}')`);
    insert('orders', keyA); insert('provisioned', keyB);
    expect(() => insert('orders', opaque())).toThrow('duplicate key');
    expect(() => insert('scoped', opaque(), digest(), integration)).toThrow('app scope mismatch');
    insert('scoped', opaque(), connected.appHash, integration);
    expect(() => db.actor(`UPDATE marketplace_provider_webhook_keys SET secret_ciphertext='${opaque()}' WHERE event='orders'`))
      .toThrow('key is immutable');
    expect(db.sql("SELECT secret_ciphertext FROM marketplace_provider_webhook_keys WHERE event='orders'")).toBe(keyA);
    expect(db.sql("SELECT secret_ciphertext FROM marketplace_provider_webhook_keys WHERE event='provisioned'")).toBe(keyB);
    expect(() => db.actor('SELECT * FROM marketplace_provider_webhook_keys', owner, 'authenticated')).toThrow('permission denied');
  });

  it('supports custom OAuth connection ciphertext without copying credentials into native site secrets', () => {
    const connected = connection({ credential_mode: 'custom' });
    const saved = save(connected.connectionId, { credential_mode: 'custom' });
    expect(saved.secret_id).toBeNull(); expect(saved.credential_mode).toBe('custom');
    expect(db.sql('SELECT count(*) FROM site_secrets')).toBe('0');
    expect(() => save(connected.connectionId, { credential_mode: 'platform' })).toThrow('identity is immutable');
  });

  it('keeps operational app access after merchant token expiry but rejects new onboarding mutations', () => {
    const connected = connection(); save(connected.connectionId); finish(provision().batch_id);
    const imported = db.ingest(normalizedOrder());
    db.actor("UPDATE marketplace_merchant_connections SET token_expires_at=now()-interval '1 minute'");
    expect(() => provision('deactivate')).toThrow('authorization unavailable');
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll()'))).toHaveLength(1);
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_action('${imported.order_id}','accept','${operator}')`)).duplicate)
      .toBe(false);
  });

  it('allows fail-closed revocation after provider discovery removes a previously authorized store', () => {
    const connected = connection(); save(connected.connectionId);
    finish(provision().batch_id);
    const imported = db.ingest(normalizedOrder());
    db.actor("UPDATE marketplace_merchant_connections SET authorized_stores='[]'");
    expect(() => db.actor(`SELECT claim_marketplace_action('${imported.order_id}','accept','${operator}')`)).toThrow('not active');
    expect(JSON.parse(db.actor('SELECT claim_marketplace_poll()'))).toEqual([]);
    expect(() => provision('deactivate')).toThrow('authorization unavailable');
    db.actor(`SELECT revoke_marketplace_merchant_connection('${connected.connectionId}','${owner}')`);
    expect(db.sql('SELECT enabled FROM marketplace_integrations')).toBe('f');
    expect(db.sql('SELECT status FROM marketplace_merchant_connections')).toBe('revoked');
    expect(db.sql('SELECT encrypted_authorization IS NULL FROM marketplace_merchant_connections')).toBe('t');
  });

  it('atomically claims event registration once, preserves unknown receipts and never resets other event keys', async () => {
    const appHash = digest();
    const scope = { app_client_id_hash: appHash, provider: 'rappi', environment: 'sandbox', country: 'MX', event: 'ORDER_CREATED' };
    const statement = `SET ROLE service_role; SELECT claim_marketplace_webhook_registration(${sqlJson(scope)})`;
    const results = await Promise.all([db.concurrent(statement), db.concurrent(statement)]);
    const claims = results.map(result => JSON.parse(result));
    expect(claims.filter(result => !result.duplicate)).toHaveLength(1);
    expect(claims[0].claim_id).toBe(claims[1].claim_id);
    const secretCiphertext = opaque();
    const claimId = claims[0].claim_id;
    db.actor(`SELECT finish_marketplace_webhook_registration('${claimId}','unknown',NULL)`);
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_webhook_registration(${sqlJson(scope)})`)))
      .toMatchObject({ duplicate: true, status: 'unknown' });
    expect(() => db.actor(`UPDATE marketplace_webhook_registrations SET status='pending'`)).toThrow('lifecycle is immutable');
    // A known provider response may finish an unknown receipt, never resubmitting registration.
    db.actor(`SELECT finish_marketplace_webhook_registration('${claimId}','ready','${secretCiphertext}')`);
    db.actor(`SELECT finish_marketplace_webhook_registration('${claimId}','ready','${opaque()}')`);
    expect(db.sql('SELECT secret_ciphertext FROM marketplace_provider_webhook_keys')).toBe(secretCiphertext);
    expect(JSON.parse(db.actor(`SELECT claim_marketplace_webhook_registration(${sqlJson(scope)})`)))
      .toMatchObject({ duplicate: true, status: 'ready' });
    const next = JSON.parse(db.actor(`SELECT claim_marketplace_webhook_registration(${sqlJson({ ...scope, event: 'STORE_STATUS' })})`));
    expect(next.duplicate).toBe(false);
    db.actor(`SELECT finish_marketplace_webhook_registration('${next.claim_id}','ready','${opaque()}')`);
    expect(db.sql('SELECT count(*) FROM marketplace_provider_webhook_keys')).toBe('2');
    expect(db.sql("SELECT secret_ciphertext FROM marketplace_provider_webhook_keys WHERE event='ORDER_CREATED'"))
      .toBe(secretCiphertext);
  });

  it('serializes appwide registration across tenants, allows ready-key checks but blocks running/unknown mutation retry', async () => {
    const appHash = digest();
    const invoke = (actor = owner, siteId = site) => `SELECT claim_marketplace_webhook_registration('${appHash}',
      'rappi','sandbox','MX','${actor}','${siteId}')`;
    const results = (await Promise.all([
      db.concurrent(`SET ROLE service_role; ${invoke()}`),
      db.concurrent(`SET ROLE service_role; ${invoke(id(3), id(11))}`),
    ])).map(result => JSON.parse(result));
    expect(results.filter(result => result.acquired)).toHaveLength(1);
    const lease = results.find(result => result.acquired);
    expect(() => db.actor(invoke(operator), operator)).toThrow('insufficient site permission');
    expect(() => db.actor(invoke(), owner, 'authenticated')).toThrow('permission denied');
    db.actor(`SELECT finish_marketplace_webhook_registration_app('${lease.claim_id}','ready')`);
    const next = JSON.parse(db.actor(invoke()));
    expect(next.acquired).toBe(true); expect(next.claim_id).not.toBe(lease.claim_id);
    expect(() => db.actor(`SELECT finish_marketplace_webhook_registration_app('${lease.claim_id}','ready')`))
      .toThrow('claim unavailable');
    db.actor(`SELECT finish_marketplace_webhook_registration_app('${next.claim_id}','unknown')`);
    expect(JSON.parse(db.actor(invoke()))).toMatchObject({ acquired: false, status: 'unknown' });
    expect(() => db.actor("UPDATE marketplace_webhook_registration_apps SET status='running'"))
      .toThrow('lifecycle is immutable');
  });
});