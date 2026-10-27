const { assertRow } = require('./provision-qa-store.cjs');
const { ensureEnglish } = require('./provision-qa-adjust.cjs');

async function visible(client, table, id, expected) {
  const result = await client.from(table).select('id').eq('id', id);
  if (result.error || !Array.isArray(result.data) || result.data.length !== (expected ? 1 : 0)
    || (expected && result.data[0].id !== id)) throw new Error(`Public user-scoped ${table} visibility verification failed`);
}

async function permission(client, site, command, expected) {
  const result = await client.rpc('user_can', { p_site_id: site, p_command: command });
  if (result.error || result.data !== expected) throw new Error('Public role permission verification failed');
}

async function verify(config, battery, store, makeClient, authorizedAdjustments = false) {
  const site = battery.rows.find(row => row.kind === 'site').row.id;
  const foreign = battery.rows.find(row => row.kind === 'foreign-site').row.id;
  const clients = {};
  try {
    for (const user of battery.users) {
      const client = makeClient(config.publicKey);
      clients[user.role] = client;
      const result = await client.auth.signInWithPassword({ email: user.email, password: store.password(user.role) });
      if (result.error || result.data?.user?.id !== user.id || result.data.user.email !== user.email) throw new Error('Public-key fixture login verification failed');
      const profile = await client.from('profiles').select('id,email').eq('id', user.id);
      if (profile.error || profile.data?.length !== 1) throw new Error('Auth profile trigger verification failed');
      assertRow(profile.data[0], { id: user.id, email: user.email });
      await ensureEnglish(client, user, store, authorizedAdjustments);
      const mainMember = ['admin', 'collaborator', 'marketing'].includes(user.role);
      await visible(client, 'sites', site, mainMember);
      await visible(client, 'sites', foreign, user.role === 'foreign');
      for (const command of ['select', 'insert', 'update', 'delete']) {
        const allowed = user.role === 'admin' || (user.role === 'collaborator' && command !== 'delete') || (user.role === 'marketing' && command === 'select');
        await permission(client, site, command, allowed);
      }
      // Lead privacy may have explicit buyer ownership reads, so use private
      // content for foreign/buyer denial rather than deny legitimate buyer data.
      await visible(client, 'content', battery.rows.find(row => row.kind === 'content').row.id, mainMember);
      if (mainMember || user.role === 'foreign') {
        const membership = battery.rows.find(row => row.kind === `membership:${user.role}`);
        const persisted = await client.from('site_members').select(Object.keys(membership.row).join(',')).eq('id', membership.row.id);
        if (persisted.error || persisted.data?.length !== 1) throw new Error('Public effective membership verification failed');
        assertRow(persisted.data[0], membership.row);
      }
      store.event(`role:${user.role}`, 'verified-public-session');
    }
    for (const item of battery.rows) {
      const client = item.kind.startsWith('foreign-') || item.kind === 'membership:foreign' ? clients.foreign : clients.admin;
      const result = await client.from(item.table).select(Object.keys(item.row).join(',')).eq('id', item.row.id);
      if (result.error || result.data?.length !== 1) throw new Error(`Public persisted fixture verification failed in ${item.table}`);
      assertRow(result.data[0], item.row);
    }
    const product = battery.rows.find(row => row.kind === 'product').row.id;
    await visible(clients.buyer, 'catalog_items', product, true);
    // No writes, payments, provider calls or inferred end-to-end coverage here.
    return { authUsers: 5, sites: 2, rows: battery.rows.length, rolesAndRls: 'verified',
      notVerified: ['browser journeys', 'completed reservation', 'Stripe settlement', 'Robot/provider lifecycle', 'social OAuth', 'storage upload'] };
  } finally {
    for (const client of Object.values(clients)) {
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* Do not expose session/provider failures in logs. */ }
    }
  }
}

module.exports = { verify, visible, permission };