const { assertRow, fingerprint } = require('./provision-qa-store.cjs');

const imageUrl = '/images/logo.png';

async function adjustImages(config, battery, store, makeClient, authorized) {
  let client;
  try {
    for (const item of battery.rows.filter(item => ['product', 'reservable', 'recurring'].includes(item.kind))) {
      const legacy = { ...item.row };
      delete legacy.image_url;
      if (store.owns(item.kind, item.row) || !store.owns(item.kind, legacy)) continue;
      if (!authorized) throw new Error('Existing catalog image adjustment requires QA_ALLOW_SMOKE_ADJUSTMENTS=1');
      if (!client) {
        client = makeClient(config.publicKey);
        const user = battery.users.find(user => user.role === 'admin');
        const auth = await client.auth.signInWithPassword({ email: user.email, password: store.password(user.role) });
        if (auth.error || auth.data?.user?.id !== user.id) throw new Error('Image adjustment QA authentication failed');
      }
      const fields = Object.keys(item.row).join(',');
      const read = () => client.from(item.table).select(fields).eq('id', item.row.id).eq('site_id', item.row.site_id);
      const current = await read();
      if (current.error || current.data?.length !== 1) throw new Error('Image adjustment exact row unavailable');
      assertRow(current.data[0], legacy);
      if (![null, imageUrl].includes(current.data[0].image_url)) throw new Error('Image adjustment rejects existing custom image');
      const key = `adjust-image:${item.kind}`;
      const adjustment = { previousFingerprint: fingerprint(legacy), fingerprint: fingerprint(item.row), id: item.row.id, image_url: imageUrl };
      // Resume only a matching durable intent if the prior update succeeded.
      if (current.data[0].image_url === imageUrl && !store.owns(key, adjustment)) throw new Error('Unjournaled image change refused');
      store.intent(key, adjustment);
      if (current.data[0].image_url === null) {
        const updated = await client.from(item.table).update({ image_url: imageUrl }).eq('id', item.row.id)
          .eq('site_id', item.row.site_id).is('image_url', null);
        if (updated.error) throw new Error('User-scoped catalog image adjustment failed');
      }
      const persisted = await read();
      if (persisted.error || persisted.data?.length !== 1) throw new Error('Image adjustment verification failed');
      assertRow(persisted.data[0], item.row);
      store.state.entries[item.kind] = { fingerprint: fingerprint(item.row), status: 'verified' };
      store.done(key);
      store.event(key, 'authorized-user-scoped-adjustment-verified');
    }
  } finally { if (client) await client.auth.signOut({ scope: 'local' }); }
}

async function ensureEnglish(client, user, store, authorized) {
  if (!store.owns(`auth:${user.role}`, user)) throw new Error('Language setup requires exact owned QA Auth identity');
  const expected = { id: user.id, email: user.email, language: 'en' };
  const key = `profile:${user.role}`;
  const read = () => client.from('profiles').select('id,email,language').eq('id', user.id);
  const current = await read();
  if (current.error || current.data?.length !== 1) throw new Error('QA profile language unavailable');
  assertRow(current.data[0], { id: user.id, email: user.email });
  const previous = current.data[0].language;
  if (!['es', 'en'].includes(previous)) throw new Error('Unexpected QA profile language; adjustment refused');
  const legacyVerified = store.state.events.some(event => event.kind === `role:${user.role}` && event.status === 'verified-public-session');
  if (!store.state.entries[key] && legacyVerified && previous !== 'en' && !authorized) throw new Error('Legacy QA profile language adjustment requires explicit consent');
  if (store.state.entries[key]?.status === 'verified' && previous !== 'en' && !authorized) throw new Error('QA profile language drift requires explicit adjustment consent');
  // First setup may initialize the bootstrap default on these exact owned QA
  // users; a live legacy run requires consent recorded by its caller.
  store.intent(key, expected);
  if (previous !== 'en') {
    const updated = await client.from('profiles').update({ language: 'en' }).eq('id', user.id).eq('email', user.email).eq('language', previous);
    if (updated.error) throw new Error('User-scoped QA profile language update failed');
  }
  const persisted = await read();
  if (persisted.error || persisted.data?.length !== 1) throw new Error('QA profile language verification failed');
  assertRow(persisted.data[0], expected);
  store.done(key);
  store.event(key, previous === 'en' ? 'verified-english' : 'user-scoped-english-setup');
}

module.exports = { adjustImages, ensureEnglish, imageUrl };