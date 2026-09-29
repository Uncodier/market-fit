const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { runId, parseArgs } = require('./options.cjs');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const model = require('../../tests/support/run-report.ts');
const cli = path.join(path.dirname(require.resolve('shiplightai/package.json')), 'dist/cli.js');
const playwright = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');

function paths(id) {
  const dir = path.join(root, 'shiplight-report', runId(id));
  return { dir, manifest: path.join(dir, 'run-manifest.json'), summary: path.join(dir, 'run-summary.json'), json: path.join(dir, 'playwright.json'), vendor: path.join(dir, 'report-data.json') };
}
function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}
function command(binary, args, env, capture = false) {
  return spawnSync(process.execPath, [binary, ...args], {
    cwd: root, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 32 * 1024 * 1024,
  });
}
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
module.exports = { fs, path, crypto, root, cli, playwright, model, runId, paths, write, read, git, command, parseArgs, digest };