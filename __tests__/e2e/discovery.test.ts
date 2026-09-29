/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type ListedSuite = { title: string; file?: string; suites?: ListedSuite[]; specs?: { title: string; tests: unknown[] }[] };
function leaves(suites: ListedSuite[]): ListedSuite[] {
  return suites.flatMap(suite => [...(suite.specs?.length ? [suite] : []), ...leaves(suite.suites || [])]);
}

it.each(['smoke', 'regression', 'buyer', 'roles'])('discovers only the intended %s tests without auth/network execution', suite => {
  const env: NodeJS.ProcessEnv = { ...process.env, TEST_SUITE: suite, SHIPLIGHT_RUN_ID: 'discovery-regression', SHIPLIGHT_OFFLINE: '1' };
  delete env.JEST_WORKER_ID;
  const result = spawnSync(process.execPath, [path.resolve('node_modules/@playwright/test/cli.js'), 'test', '--list', '--reporter=json'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 60_000,
    env,
  });
  const output = result.stdout || '';
  if (result.status !== 0) throw new Error(`Discovery failed: ${output || result.stderr}`);
  const json = JSON.parse(output.slice(output.indexOf('{\n')));
  const found = leaves(json.suites);
  const files = found.map(item => item.file || item.title);
  expect(files.length).toBeGreaterThan(0);
  expect(files.join('\n')).not.toMatch(/arch\.yaml|example\.yaml|tests\/agent\//);
  if (suite === 'smoke') {
    expect(files).toEqual(expect.arrayContaining(['auth.setup.ts', 'tests/smoke/public.spec.ts', 'tests/smoke/workspace.spec.ts']));
    expect(found.flatMap(item => item.specs || [])).toHaveLength(7);
  }
  if (suite === 'buyer') expect(files.join('\n')).not.toContain('auth.setup.ts');
  if (suite === 'regression') expect(files.join('\n')).not.toContain('buyer-navigation');
  // Listing must never bootstrap authenticated sessions.
  expect(fs.existsSync('.auth/local/discovery-regression')).toBe(false);
}, 65_000);