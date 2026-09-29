/** @jest-environment node */
import fs from 'node:fs';

it('does not use the Shiplight CI test wrapper which publishes action caches independently', () => {
  const run = fs.readFileSync('scripts/e2e/run.cjs', 'utf8');
  expect(run).toContain("c.command(c.playwright, ['test'");
  expect(run).not.toContain("c.command(c.cli, ['test'");
  expect(run).toContain("SHIPLIGHT_TELEMETRY: '0'");
  expect(run).toContain("DO_NOT_TRACK: '1'");
});
it('selects visible inputs rather than hidden mobile duplicates in desktop smoke', () => {
  const source = fs.readFileSync('tests/smoke/workspace.spec.ts', 'utf8');
  expect(source).toContain("getByPlaceholder('Search content...').filter({ visible: true })");
  expect(source).toContain("getByPlaceholder('Search leads...').filter({ visible: true })");
});
it('terminates the whole mutating engine process group and avoids permission bypasses', () => {
  const source = fs.readFileSync('tests/agent/agent-engine.ts', 'utf8');
  expect(source).toContain("process.kill(-child.pid, 'SIGKILL')");
  expect(source).toContain("detached: process.platform !== 'win32'");
  expect(source).not.toMatch(/danger-full-access|bypassPermissions/);
});