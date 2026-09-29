/** @jest-environment node */
const { parseArgs, runId } = require('../../scripts/e2e/options.cjs');

describe('safe runner arguments', () => {
  it('inherits explicit target/suite and defaults only to smoke', () => {
    expect(parseArgs([], {})).toMatchObject({ target: null, suite: 'smoke' });
    expect(parseArgs([], { TEST_TARGET: 'production', TEST_SUITE: 'smoke' })).toMatchObject({ target: 'production', suite: 'smoke' });
    expect(parseArgs(['--suite', 'regression', '--target', 'staging', '--list'], {})).toMatchObject({ target: 'staging', suite: 'regression', list: true });
  });
  it.each(['--config', '--project', '--shard', '--workers', '--no-deps', '--pass-with-no-tests', 'nested/test.spec.ts'])('rejects hidden scope or safety override %s', value => {
    expect(() => parseArgs([value], {})).toThrow();
  });
  it('permits only an explicit visible partial grep', () => {
    expect(parseArgs(['--grep', 'login'], {})).toMatchObject({ grep: 'login' });
    expect(() => parseArgs(['--grep', '['], {})).toThrow();
    expect(() => parseArgs(['--suite', 'smoke', '--suite', 'roles'], {})).toThrow();
    expect(() => parseArgs(['--suite'], {})).toThrow();
  });
  it.each(['latest', '../old', 'old/report', 'run:123', '.', ''])('rejects unsafe/historical run ID %s', value => {
    expect(() => runId(value)).toThrow();
  });
  it('accepts isolated run IDs', () => expect(runId('gh-123_2')).toBe('gh-123_2'));
});