const { fixtureId } = require('./provision-qa-policy.cjs');
const roles = ['admin', 'collaborator', 'marketing', 'foreign', 'buyer'];
const marker = 'market-fit-qa-v1';

function plan(config) {
  const id = kind => fixtureId(config.id, kind);
  const name = kind => `${config.id} ${kind}`;
  const ownership = { qa_fixture: marker, qa_environment_id: config.id, qa_expires_at: config.expiresAt };
  const users = roles.map(role => ({ role, id: id(`auth:${role}`), email: `${role}@${config.id}.invalid`, name: name(role),
    app_metadata: { ...ownership, qa_role: role } }));
  const admin = users[0].id;
  const foreign = users[3].id;
  const site = id('site');
  const other = id('foreign-site');
  const rows = [];
  function add(kind, table, row, field = 'name') {
    rows.push({ kind, table, field, row: { id: id(kind), ...row } });
  }
  add('site', 'sites', { name: name('workspace'), user_id: admin, description: JSON.stringify(ownership), tracking: { record_screen: false, track_actions: false, track_visitors: false } });
  add('foreign-site', 'sites', { name: name('foreign workspace'), user_id: foreign, description: JSON.stringify(ownership) });
  for (const [prefix, siteId] of [['', site], ['foreign-', other]]) {
    // Local manual entitlement only. No provider IDs, payments, credits or workflows.
    add(`${prefix}billing`, 'billing', { site_id: siteId, plan: 'engine', status: 'active', auto_renew: false, stripe_subscription_id: null }, 'site_id');
    // Seed before members: member triggers otherwise generate an unowned settings UUID.
    add(`${prefix}settings`, 'settings', { site_id: siteId, about: name(`${prefix}settings`), currency: 'USD', default_locale: 'en',
      shop: { enabled: true }, commerce: { decrement_stock_on: 'ship', stock_shortage_policy: 'allow', default_availability_mode: 'manual' } }, 'site_id');
  }
  for (const user of users.filter(user => user.role !== 'buyer')) {
    add(`membership:${user.role}`, 'site_members', { site_id: user.role === 'foreign' ? other : site,
      user_id: user.id, email: user.email, name: user.name, role: user.role === 'foreign' ? 'admin' : user.role,
      added_by: user.role === 'foreign' ? foreign : admin, status: 'active', license_suspended: false,
      manually_disabled: false, blocked_screens: [], restrict_to_assigned_only: false }, 'email');
  }
  add('catalog-category', 'catalog_categories', { site_id: site, name: name('catalog category'), status: 'active' });
  add('record-category', 'record_categories', { site_id: site, name: name('record category'), template_fields: [] });
  // Companies are global in this schema, not tenant-scoped. Use run-owned name+ID.
  add('company', 'companies', { name: name('company'), email: `company@${config.id}.invalid`, industry: 'technology', size: '1-10' });
  add('expense-account', 'accounting_accounts', { site_id: site, code: config.id, key: config.id, label: name('expense account'), type: 'expense', system: false, active: true }, 'code');
  add('agent', 'agents', { site_id: site, user_id: admin, name: name('agent'), type: 'support', status: 'inactive', prompt: 'Local QA only. Do not contact external services.', configuration: ownership });
  add('campaign', 'campaigns', { site_id: site, user_id: admin, title: name('campaign'), type: 'email', status: 'pending', metadata: ownership }, 'title');
  for (const kind of ['product', 'reservable', 'recurring']) {
    add(kind, 'catalog_items', { site_id: site, category_id: id('catalog-category'), name: name(kind), sku: `${config.id}-${kind}`,
      kind: kind === 'reservable' ? 'service' : 'product', status: 'active', currency: 'USD', target_sale_price: 0,
      lowest_sale_price: 0, cost: 0, track_inventory: false, availability_mode: 'always', availability_status: 'available',
      is_purchasable: true, is_reservation: kind === 'reservable', is_recurring: kind === 'recurring',
      is_marketplace_listed: true, is_pos_available: true, metadata: ownership });
  }
  add('content', 'content', { site_id: site, user_id: admin, author_id: admin, title: name('smoke content'), type: 'blog_post',
    status: 'draft', text: 'Deterministic local QA smoke content.', campaign_id: id('campaign'), metadata: ownership }, 'title');
  add('lead', 'leads', { site_id: site, user_id: admin, name: name('smoke lead'), status: 'new', email: users[4].email,
    buyer_user_id: users[4].id, company_id: id('company'), campaign_id: id('campaign'), metadata: ownership });
  return { users, rows, ownership };
}

function environment(config, battery, credentials) {
  const row = kind => battery.rows.find(item => item.kind === kind).row;
  const values = { QA_ENVIRONMENT_ID: config.id, QA_EXPIRES_AT: config.expiresAt, TEST_TARGET: 'local', TEST_SUITE: 'smoke',
    TEST_BASE_URL: config.baseURL, TEST_COMMERCE_BASE_URL: config.commerceURL, TEST_SUPABASE_URL: config.url,
    TEST_SUPABASE_ANON_KEY: config.publicKey, TEST_ALLOW_MUTATIONS: '0', TEST_DISPOSABLE_ENVIRONMENT: '1', TEST_WORKERS: '1',
    TEST_SITE_ID: row('site').id, TEST_SITE_NAME: row('site').name, TEST_FOREIGN_SITE_ID: row('foreign-site').id,
    TEST_SHOP_SLUG: row('site').id, TEST_CATALOG_ITEM_ID: row('product').id, TEST_CATALOG_ITEM_NAME: row('product').name,
    TEST_CONTENT_NAME: row('content').title, TEST_LEAD_NAME: row('lead').name, TEST_INVITE_EMAIL_DOMAIN: `${config.id}.invalid`,
    TEST_ASSET_BUCKET: 'assets', TEST_ASSET_PREFIX: `${config.id}/`,
    TEST_RESERVATION_CUSTOMER_ID: row('lead').id, TEST_RESERVATION_CUSTOMER_NAME: row('lead').name };
  for (const user of battery.users) {
    values[`TEST_${user.role.toUpperCase()}_EMAIL`] = user.email;
    values[`TEST_${user.role.toUpperCase()}_PASSWORD`] = credentials[user.role];
    values[`TEST_${user.role.toUpperCase()}_USER_ID`] = user.id;
  }
  for (const item of battery.rows) {
    const key = item.kind.replace(/[:-]/g, '_').toUpperCase();
    values[`TEST_${key}_ID`] = item.row.id;
    if (item.row.name || item.row.title || item.row.label) values[`TEST_${key}_NAME`] = item.row.name || item.row.title || item.row.label;
  }
  values.TEST_RESERVABLE_CATALOG_ITEM_ID = row('reservable').id;
  values.TEST_RECURRING_CATALOG_ITEM_ID = row('recurring').id;
  return values;
}

module.exports = { plan, environment, marker, roles };