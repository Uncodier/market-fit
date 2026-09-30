/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentEnvironment, parseStatus, targetEnvDefaults, validateAgentEvidence } from '../../tests/agent/agent-evidence';

it('accepts only one exact terminal status, never an earlier PASS', () => {
  expect(parseStatus('Evidence\nStatus: PASS\n')).toBe('PASS');
  expect(parseStatus('Status: PASS\nStatus: FAIL')).toBeUndefined();
  expect(parseStatus('Status: PASS\nmore text')).toBeUndefined();
  expect(parseStatus('No status')).toBeUndefined();
});
it('never maps production agent execution to localhost or another application', () => {
  expect(() => targetEnvDefaults('production', {})).toThrow();
  expect(() => targetEnvDefaults('staging', { TEST_TARGET: 'local' })).toThrow('disagrees');
});
it('does not expose ambient production backend and payment secrets to the engine', () => {
  expect(agentEnvironment({ PATH: '/bin', TEST_ADMIN_EMAIL: 'test@example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'secret', STRIPE_SECRET_KEY: 'secret', SERVICE_API_KEY: 'secret' })).toEqual({ NODE_ENV: 'test', PATH: '/bin', TEST_ADMIN_EMAIL: 'test@example.invalid' });
});
it('requires current distinct channel evidence and successful UI artifacts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-evidence-'));
  const report = path.join(directory, 'report.json');
  fs.writeFileSync(report, JSON.stringify({ tests: ['pos', 'shop', 'reservations-page'].map(channel => ({
    status: 'passed', file: `tests/reserve-in-${channel}.yaml.spec.ts`, startTime: new Date().toISOString(),
  })) }));
  const siteId = '11111111-1111-4111-8111-111111111111';
  const itemId = '22222222-2222-4222-8222-222222222222';
  const expected = { runId: 'current', target: 'local', siteId, startedAt: Date.now() - 1000 };
  const value = { runId: 'current', target: 'local', siteId, itemId,
    observations: ['pos', 'shop', 'manual'].map((channel, index) => ({ channel, itemId, siteId,
      reservationId: `33333333-3333-4333-8333-33333333333${index}`, observedAt: new Date().toISOString(), persisted: true, uiReportPath: report })),
    cleanup: { completed: true, verified: true } };
  try {
    expect(() => validateAgentEvidence(value, expected)).not.toThrow();
    expect(() => validateAgentEvidence({ ...value, runId: 'stale' }, expected)).toThrow();
    expect(() => validateAgentEvidence({ ...value, observations: value.observations.slice(1) }, expected)).toThrow();
    expect(() => validateAgentEvidence({ ...value, cleanup: { completed: false, verified: false } }, expected)).toThrow();
    fs.writeFileSync(report, JSON.stringify({ tests: [{ status: 'failed' }] }));
    expect(() => validateAgentEvidence(value, expected)).toThrow('did not pass');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});