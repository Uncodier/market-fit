const { createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const marker = 'shiplight-production-smoke-v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function fixtureId(siteId, kind) {
  if (!uuid.test(siteId)) throw new Error('Fixture site must be a UUID');
  const hex = createHash('sha256').update(`${marker}:${siteId.toLowerCase()}:${kind}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fixturePlan(siteId, userId) {
  if (!uuid.test(userId)) throw new Error('Authenticated user must be a UUID');
  const metadata = { qa_fixture: marker };
  return [
    { table: 'content', field: 'title', row: {
      id: fixtureId(siteId, 'content'), site_id: siteId, user_id: userId, author_id: userId,
      title: 'QA Smoke Content', type: 'blog_post', status: 'draft',
      description: 'Synthetic read-only smoke fixture. Do not publish or automate.',
      text: 'Synthetic QA content; not customer or marketing material.', metadata,
    } },
    { table: 'leads', field: 'name', row: {
      id: fixtureId(siteId, 'lead'), site_id: siteId, user_id: userId,
      name: 'QA Smoke Lead', status: 'new', origin: 'inbound', email: null, phone: null,
      notes: 'Synthetic smoke fixture. Do not contact or automate.',
      do_not_call: true, voice_call_consent_status: 'revoked', metadata,
    } },
    { table: 'catalog_items', field: 'name', row: {
      id: fixtureId(siteId, 'catalog'), site_id: siteId,
      name: 'QA Smoke Product - NOT FOR SALE', kind: 'product', status: 'active',
      description: 'Synthetic QA display fixture. Not for sale or fulfillment.',
      is_marketplace_listed: true, is_purchasable: false, is_pos_available: false,
      is_recurring: false, is_reservation: false, track_inventory: false,
      availability_mode: 'manual', availability_status: 'available',
      parent_id: null, category_id: null, target_sale_price: 1, currency: 'USD',
      sort_order: -1000000, metadata,
    } },
  ];
}

function parseOptions(args) {
  const options = { apply: false, writeEnv: false, ackWorkflows: false, siteId: null };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === '--apply') options.apply = true;
    else if (flag === '--write-env') options.writeEnv = true;
    else if (flag === '--ack-workflows') options.ackWorkflows = true;
    else if (flag === '--site-id' && uuid.test(args[i + 1] || '')) options.siteId = args[++i];
    else throw new Error(`Unsupported or invalid option: ${flag}`);
  }
  if (options.apply && (!options.siteId || !options.ackWorkflows)) {
    throw new Error('Insertion requires --apply --site-id <UUID> --ack-workflows; content/lead inserts can trigger workflows');
  }
  return options;
}

async function connect(env) {
  if (required(env, 'TEST_TARGET') !== 'production') throw new Error('This provisioner is production-only');
  if (required(env, 'TEST_BASE_URL') !== 'https://app.makinari.com' ||
      !['https://www.makinari.com', 'https://makinari.com'].includes(required(env, 'TEST_COMMERCE_BASE_URL'))) {
    throw new Error('Explicit production app and commerce origins are required');
  }
  const url = required(env, 'TEST_SUPABASE_URL');
  const ref = required(env, 'TEST_SUPABASE_PROJECT_REF');
  if (!/^[a-z0-9]{20}$/.test(ref) || url !== `https://${ref}.supabase.co` ||
      url !== required(env, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')) {
    throw new Error('Fixture backend must match the explicitly selected application backend');
  }
  const key = required(env, 'TEST_SUPABASE_ANON_KEY');
  if (!key.startsWith('sb_publishable_')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* rejected below */ }
    if (role !== 'anon') throw new Error('A public key is required; service-role keys are forbidden');
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
  });
  const email = required(env, 'TEST_ADMIN_EMAIL');
  const auth = await client.auth.signInWithPassword({ email, password: required(env, 'TEST_ADMIN_PASSWORD') });
  if (auth.error || !auth.data.user || auth.data.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error('Test account authentication failed');
  }
  return { client, userId: auth.data.user.id };
}

async function resolveSite(client, userId, env, requestedId) {
  const name = required(env, 'TEST_SITE_NAME');
  let query = client.from('sites').select('id,name,user_id,archived_at').eq('name', name);
  const id = env.TEST_SITE_ID?.trim();
  if (id) {
    if (!uuid.test(id)) throw new Error('TEST_SITE_ID must be a UUID');
    query = query.eq('id', id);
  }
  const result = await query;
  if (result.error || result.data?.length !== 1) throw new Error('Configured site must resolve exactly once; refusing ambiguous selection');
  const site = result.data[0];
  if (site.archived_at) throw new Error('Archived sites cannot host smoke fixtures');
  if (requestedId && requestedId.toLowerCase() !== site.id.toLowerCase()) throw new Error('Acknowledged site ID does not match the configured site');
  if (site.user_id !== userId) {
    const membership = await client.from('site_members').select('role,status')
      .eq('site_id', site.id).eq('user_id', userId).single();
    if (membership.error || membership.data?.role !== 'admin' || membership.data?.status !== 'active') {
      throw new Error('Test account requires owner or active admin membership');
    }
  }
  return site;
}

function assertFixture(row, expected) {
  for (const [field, value] of Object.entries(expected)) {
    const matches = field === 'metadata' ? row.metadata?.qa_fixture === marker
      : typeof value === 'number' ? Number(row[field]) === value : row[field] === value;
    if (!matches) throw new Error(`Existing QA fixture differs at ${field}; refusing to overwrite it`);
  }
}

async function inspectFixtures(client, plan) {
  const states = [];
  for (const fixture of plan) {
    const result = await client.from(fixture.table).select(Object.keys(fixture.row).join(','))
      .eq('site_id', fixture.row.site_id).eq('id', fixture.row.id);
    if (result.error) throw new Error(`Unable to inspect ${fixture.table} (${result.error.code})`);
    if (result.data?.length > 1) throw new Error('Ambiguous fixture ID');
    const names = await client.from(fixture.table).select('id').eq('site_id', fixture.row.site_id)
      .eq(fixture.field, fixture.row[fixture.field]);
    if (names.error) throw new Error(`Unable to inspect ${fixture.table} names`);
    if (names.data?.some(row => row.id !== fixture.row.id)) throw new Error(`QA name collision in ${fixture.table}; refusing reuse`);
    if (result.data?.length) assertFixture(result.data[0], fixture.row);
    states.push({ ...fixture, exists: !!result.data?.length });
  }
  return states;
}

async function insertMissing(client, states) {
  for (const fixture of states) {
    if (fixture.exists) continue;
    const result = await client.from(fixture.table).insert(fixture.row).select(Object.keys(fixture.row).join(',')).single();
    if (result.error || !result.data) {
      throw new Error(`Insertion of ${fixture.table} failed (${result.error?.code || 'no result'}); prior inserts may remain. Rerun dry-run; no automatic delete or retry.`);
    }
    assertFixture(result.data, fixture.row);
  }
  // Verify persisted records using scoped reads, not just the insertion response.
  const verified = await inspectFixtures(client, states);
  if (verified.some(fixture => !fixture.exists)) throw new Error('Persisted fixture verification failed');
}

function environmentValues(site) {
  return {
    TEST_TARGET: 'production', TEST_SUITE: 'smoke',
    TEST_BASE_URL: 'https://app.makinari.com', TEST_COMMERCE_BASE_URL: 'https://www.makinari.com',
    TEST_SITE_ID: site.id, TEST_SITE_NAME: site.name,
    // UUID is a supported shop URL segment and avoids ambiguous name-slug resolution.
    TEST_SHOP_SLUG: site.id, TEST_CATALOG_ITEM_ID: fixtureId(site.id, 'catalog'),
    TEST_CATALOG_ITEM_NAME: 'QA Smoke Product - NOT FOR SALE',
    TEST_CONTENT_NAME: 'QA Smoke Content', TEST_LEAD_NAME: 'QA Smoke Lead',
    TEST_ALLOW_MUTATIONS: '0', TEST_DISPOSABLE_ENVIRONMENT: '0',
  };
}

module.exports = { marker, fixtureId, fixturePlan, parseOptions, connect, resolveSite,
  assertFixture, inspectFixtures, insertMissing, environmentValues };