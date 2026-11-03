'use strict';

const fs = require('node:fs');
const { isAbsolute } = require('node:path');
const { evaluateExistingApp } = require('./existing-app-evidence.cjs');
const MAX_BYTES = 4 * 1024 * 1024;

// Offline JSON input only; never load env files, credentials or the live runner.
function main(args, io = { read: file => fs.readFileSync(file), write: text => process.stdout.write(text) }) {
  let report;
  try {
    if (args.length !== 1 || !isAbsolute(args[0])) throw new Error('Invalid input');
    const bytes = io.read(args[0]);
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES) throw new Error('Invalid input');
    report = evaluateExistingApp(JSON.parse(bytes.toString('utf8')));
  } catch {
    report = { schemaVersion: 1, caseId: null, state: 'blocked', passed: false,
      checks: [{ name: 'offline_input_readable', passed: false }] };
  }
  io.write(`${JSON.stringify(report)}\n`);
  return report.passed === true ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };