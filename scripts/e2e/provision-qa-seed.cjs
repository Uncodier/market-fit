const { assertRow } = require('./provision-qa-store.cjs');

async function inspectRow(client, item) {
  const result = await client.from(item.table).select(Object.keys(item.row).join(',')).eq('id', item.row.id);
  if (result.error || !Array.isArray(result.data) || result.data.length > 1) throw new Error(`Cannot inspect ${item.table}`);
  let query = client.from(item.table).select('id').eq(item.field, item.row[item.field]);
  if (item.row.site_id && item.field !== 'site_id') query = query.eq('site_id', item.row.site_id);
  const names = await query;
  if (names.error || !Array.isArray(names.data)) throw new Error(`Cannot inspect ${item.table} identities`);
  if (names.data.some(row => row.id !== item.row.id)) throw new Error(`Identity collision in ${item.table}`);
  return result.data[0];
}

async function seedRows(client, battery, store) {
  // Inspect all identities before the first relational write. Still recheck each
  // insertion, because triggers/concurrent writers may introduce a collision.
  for (const item of battery.rows) {
    const existing = await inspectRow(client, item);
    if (existing) {
      if (!store.owns(item.kind, item.row)) throw new Error(`Unowned collision in ${item.table}`);
      assertRow(existing, item.row);
    }
  }
  for (const item of battery.rows) {
    const existing = await inspectRow(client, item);
    if (existing) {
      if (!store.owns(item.kind, item.row)) throw new Error(`Unowned collision in ${item.table}`);
      assertRow(existing, item.row);
    } else {
      if (item.kind === 'expense-account' && item.table === 'accounting_accounts' && item.field === 'code') {
        store.repairAbsentExpenseIntent(item.row);
      }
      store.intent(item.kind, item.row);
      const inserted = await client.from(item.table).insert(item.row);
      if (inserted.error) throw new Error(`Setup insert failed in ${item.table}; partial fixtures remain, no automatic retry/delete`);
      const persisted = await inspectRow(client, item);
      if (!persisted) throw new Error(`Missing persisted ${item.table}`);
      assertRow(persisted, item.row);
    }
    store.done(item.kind);
  }
}

function assertAuth(actual, user) {
  if (!actual || actual.id !== user.id || actual.email !== user.email || !actual.email_confirmed_at) throw new Error('Auth identity collision or unconfirmed email');
  assertRow(actual.app_metadata || {}, user.app_metadata);
}

async function seedAuth(client, battery, store) {
  // Explicit exhaustive pagination prevents adopting an email under another ID.
  const users = [];
  for (let page = 1; ; page++) {
    if (page > 1000) throw new Error('Auth inventory exceeds safe pagination limit');
    const result = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error || !Array.isArray(result.data?.users)) throw new Error('Auth inventory failed');
    users.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  for (const user of battery.users) {
    const matches = users.filter(actual => actual.id === user.id || actual.email?.toLowerCase() === user.email);
    if (matches.length) {
      if (matches.length !== 1 || !store.owns(`auth:${user.role}`, user)) throw new Error('Unowned Auth collision');
      assertAuth(matches[0], user);
    }
  }
  for (const user of battery.users) {
    store.password(user.role);
    if (!users.some(actual => actual.id === user.id)) {
      store.intent(`auth:${user.role}`, user);
      const result = await client.auth.admin.createUser({ id: user.id, email: user.email, password: store.password(user.role),
        email_confirm: true, app_metadata: user.app_metadata, user_metadata: { name: user.name } });
      if (result.error) throw new Error('Auth setup failed; partial fixtures remain, no automatic retry/delete');
      assertAuth(result.data?.user, user);
    }
    const persisted = await client.auth.admin.getUserById(user.id);
    if (persisted.error) throw new Error('Auth persisted verification failed');
    assertAuth(persisted.data?.user, user);
    store.done(`auth:${user.role}`);
  }
}

async function assetBucket(client, store) {
  const result = await client.storage.listBuckets();
  if (result.error || !Array.isArray(result.data)) throw new Error('Bucket inspection failed');
  const buckets = result.data.filter(bucket => bucket.id === 'assets' || bucket.name === 'assets');
  if (buckets.length > 1 || buckets.some(bucket => bucket.id !== 'assets' || bucket.name !== 'assets' || bucket.public !== true)) throw new Error('Incompatible shared assets bucket; no overwrite permitted');
  if (!buckets.length) {
    const created = await client.storage.createBucket('assets', { public: true });
    if (created.error) throw new Error('Assets bucket setup failed');
  }
  const verified = await client.storage.getBucket('assets');
  if (verified.error || verified.data?.id !== 'assets' || verified.data?.public !== true) throw new Error('Assets bucket persisted verification failed');
  // This application-wide named prerequisite is explicitly not a run-owned row.
  store.event('shared-assets-bucket', buckets.length ? 'verified-existing-prerequisite' : 'created-shared-prerequisite');
}

module.exports = { inspectRow, seedRows, seedAuth, assertAuth, assetBucket };