import fs from 'node:fs';
import { z } from 'zod';
import { readEnvironment, assertDisposable } from '../support/environment';

export function parseStatus(report: string): 'PASS' | 'FAIL' | 'BLOCKED' | 'ABORTED' | undefined {
  const lines = report.trim().split(/\r?\n/);
  const statuses = lines.filter(line => /^Status: (PASS|FAIL|BLOCKED|ABORTED)$/.test(line));
  if (statuses.length !== 1 || statuses[0] !== lines.at(-1)) return undefined;
  return statuses[0].slice(8) as ReturnType<typeof parseStatus>;
}

export function targetEnvDefaults(target: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  if (target === 'production') throw new Error('Mutating agent workflows are forbidden in production');
  if (env.TEST_TARGET && env.TEST_TARGET !== target) throw new Error('Agent target disagrees with TEST_TARGET');
  const config = readEnvironment({ ...env, TEST_TARGET: target, TEST_SUITE: 'regression' });
  assertDisposable(env, target);
  return { TEST_TARGET: target, TEST_SUITE: 'regression', WEB_URL: config.commerceBaseURL, ADMIN_URL: config.baseURL };
}

/** Do not pass production provider/service credentials from the shell to an agent. */
export function agentEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = new Set(['PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'TERM',
    'SHIPLIGHT_API_TOKEN', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'CI']);
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.has(key) || key.startsWith('TEST_') || key.startsWith('AGENT_VERIFICATION_')));
}

const observation = z.object({
  channel: z.enum(['pos', 'shop', 'manual']),
  reservationId: z.string().uuid(),
  itemId: z.string().uuid(),
  siteId: z.string().uuid(),
  observedAt: z.string().datetime(),
  persisted: z.literal(true),
  uiReportPath: z.string().min(1),
});
const evidence = z.object({
  runId: z.string().min(1),
  target: z.enum(['local', 'staging']),
  siteId: z.string().uuid(),
  itemId: z.string().uuid(),
  observations: z.array(observation).length(3),
  cleanup: z.object({ completed: z.literal(true), verified: z.literal(true) }),
});

/** Structured evidence binds an agent verdict to this attempt, not a stale markdown PASS. */
export function validateAgentEvidence(value: unknown, expected: { runId: string; target: string; siteId: string; startedAt: number }): void {
  const data = evidence.parse(value);
  if (data.runId !== expected.runId || data.target !== expected.target || data.siteId !== expected.siteId) {
    throw new Error('Agent evidence belongs to another run or environment');
  }
  if (new Set(data.observations.map(row => row.channel)).size !== 3 || new Set(data.observations.map(row => row.reservationId)).size !== 3) {
    throw new Error('Evidence requires three distinct channel reservations');
  }
  for (const row of data.observations) {
    if (row.itemId !== data.itemId || row.siteId !== data.siteId || Date.parse(row.observedAt) < expected.startedAt || Date.parse(row.observedAt) > Date.now()) {
      throw new Error('Reservation evidence is stale or does not match the fixture');
    }
    if (!fs.existsSync(row.uiReportPath)) throw new Error('Missing channel UI report artifact');
    const report = JSON.parse(fs.readFileSync(row.uiReportPath, 'utf8'));
    if (!Array.isArray(report.tests) || report.tests.length === 0 || report.tests.some((test: { status?: string }) => test.status !== 'passed')) {
      throw new Error('Channel UI execution did not pass');
    }
    const segment = row.channel === 'manual' ? 'reserve-in-reservations-page' : `reserve-in-${row.channel}`;
    const tested = report.tests.find((test: { file?: string }) => test.file?.endsWith(`${segment}.yaml.spec.ts`));
    if (!tested || !Number.isFinite(Date.parse(tested.startTime)) || Date.parse(tested.startTime) < expected.startedAt) {
      throw new Error('Channel UI artifact is stale or does not execute the required segment');
    }
  }
}