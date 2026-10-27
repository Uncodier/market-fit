const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

function fingerprint(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function privateDirectory(dir) {
  if (fs.existsSync(dir)) {
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe fixture directory');
  } else fs.mkdirSync(dir, { mode: 0o700 });
  fs.chmodSync(dir, 0o700);
}

function openStore(root, config) {
  let dir = root;
  for (const segment of ['.auth', 'qa-fixtures', config.id]) {
    dir = path.join(dir, segment);
    privateDirectory(dir);
  }
  const lock = path.join(dir, 'lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); } catch { throw new Error('Fixture run locked; inspect any interrupted process before removing its lock'); }
  const write = (name, value) => {
    const file = path.join(dir, name);
    const temp = path.join(dir, `${name}.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  };
  try {
    const file = path.join(dir, 'journal.json');
    let state;
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Unsafe journal permissions');
      state = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isDeepStrictEqual(state.binding, { version: 1, id: config.id, expiresAt: config.expiresAt, url: config.url })) throw new Error('Journal environment binding differs; refusing adoption');
    } else {
      state = { binding: { version: 1, id: config.id, expiresAt: config.expiresAt, url: config.url }, credentials: {}, entries: {}, events: [] };
      write('journal.json', state);
    }
    const save = () => write('journal.json', state);
    return { dir, state, write, save,
      password(role) {
        if (!state.credentials[role]) { state.credentials[role] = `${randomBytes(24).toString('base64url')}!aA1`; save(); }
        return state.credentials[role];
      },
      owns(key, value) { return state.entries[key]?.fingerprint === fingerprint(value); },
      repairAbsentExpenseIntent(value) {
        // Called only after a fresh setup read proves both exact ID and scoped
        // code identity absent. This is the single known legacy-plan repair,
        // not permission to revise arbitrary intents or verified fixtures.
        const entry = state.entries['expense-account'];
        if (!entry || this.owns('expense-account', value)) return;
        const legacy = { ...value, key: config.id };
        if (entry.status !== 'intent' || entry.fingerprint !== fingerprint(legacy)
          || value.code !== config.id || value.key !== config.id.replace(/-/g, '_')
          || value.type !== 'expense' || value.system !== false) {
          throw new Error('Expense intent repair refused; legacy plan or status differs');
        }
        state.entries['expense-account'] = { fingerprint: fingerprint(value), status: 'intent' };
        state.events.push({ at: new Date().toISOString(), kind: 'expense-account-key-repair', status: 'legacy-intent-reconciled-after-absence',
          previousFingerprint: entry.fingerprint, fingerprint: fingerprint(value) });
        save();
      },
      intent(key, value) {
        if (state.entries[key] && !this.owns(key, value)) throw new Error('Owned fixture plan changed; use a new QA environment ID');
        state.entries[key] = { fingerprint: fingerprint(value), status: 'intent' }; save();
      },
      done(key) { state.entries[key].status = 'verified'; save(); },
      event(kind, status) { state.events.push({ at: new Date().toISOString(), kind, status }); save(); },
      close() { fs.closeSync(fd); fs.unlinkSync(lock); },
    };
  } catch (error) { fs.closeSync(fd); fs.unlinkSync(lock); throw error; }
}

function assertRow(actual, expected) {
  for (const [field, value] of Object.entries(expected)) {
    const match = typeof value === 'number' ? actual[field] !== null && Number(actual[field]) === value
      : isDeepStrictEqual(actual[field], value);
    if (!match) throw new Error(`Fixture collision or drift at ${field}; no overwrite permitted`);
  }
}

module.exports = { openStore, assertRow, fingerprint };