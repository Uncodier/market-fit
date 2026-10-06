const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const fixtures = require('./smoke-fixtures.cjs');
const root = path.resolve(__dirname, '../..');
const envPath = path.join(root, '.env.local');

function mergeEnv(original, values) {
  const remaining = new Set(Object.keys(values));
  const lines = original.split(/\r?\n/).filter(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/)?.[1];
    return !key || !remaining.has(key);
  });
  const encoded = Object.entries(values).map(([key, value]) => {
    if (/[\r\n]/.test(value)) throw new Error(`Multiline environment value refused: ${key}`);
    // Single-quoted dotenv values preserve hashes and double quotes literally.
    if (value.includes("'")) {
      if (value.includes('"')) throw new Error(`Unsupported quote combination in ${key}`);
      return `${key}="${value}"`;
    }
    return `${key}='${value}'`;
  });
  return `${lines.join('\n').trimEnd()}\n\n${encoded.join('\n')}\n`;
}

function writeEnvironment(original, values) {
  const content = mergeEnv(original, values);
  if (fs.readFileSync(envPath, 'utf8') !== original) throw new Error('.env.local changed during provisioning; refusing overwrite');
  const temporary = `${envPath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, envPath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function main(args = process.argv.slice(2)) {
  const options = fixtures.parseOptions(args);
  const original = fs.readFileSync(envPath, 'utf8');
  dotenv.config({ path: path.join(root, '.env'), quiet: true });
  dotenv.config({ path: envPath, quiet: true });
  const { client, userId } = await fixtures.connect(process.env);
  const site = await fixtures.resolveSite(client, userId, process.env, options.siteId);
  const plan = fixtures.fixturePlan(site.id, userId);
  const states = await fixtures.inspectFixtures(client, plan);
  console.log(`Confirmed test workspace: ${site.name} (${site.id})`);
  console.log('WARNING: content/lead INSERT triggers production workflow webhooks; QA metadata does not suppress them.');
  console.log('WARNING: the synthetic product is publicly listed, but marked not purchasable.');
  for (const state of states) console.log(`${state.table}: ${state.row.id} — ${state.exists ? 'verified existing' : 'would insert'}`);
  if (options.apply) await fixtures.insertMissing(client, states);
  if (options.writeEnv) {
    writeEnvironment(original, fixtures.environmentValues(site));
    console.log('Updated .env.local; buyer credentials and deployment SHA were not invented or overwritten.');
  }
  const complete = options.apply || states.every(state => state.exists);
  console.log(complete ? 'All smoke fixtures verified. No existing business rows were updated or deleted.'
    : 'DRY RUN: no database rows were changed. Planned env values refer to fixtures that do not yet exist.');
}

if (require.main === module) main().catch(error => {
  // Never print raw database/provider responses, credentials or session objects.
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = { mergeEnv, main };