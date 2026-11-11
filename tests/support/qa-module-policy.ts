import { assertDisposable, readEnvironment, required, validateOrigin } from './environment';

/** Module mutation journeys run only inside a verified, expiring installer QA stack. */
export function qaModulePolicy(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const config = readEnvironment(env);
  assertDisposable(env, config.target);
  if (!['procurement', 'subsystems', 'records'].includes(config.suite) || config.target !== 'local') {
    throw new Error('Module journeys require their isolated local QA suite');
  }
  if (env.QA_STATUS !== 'VERIFIED') throw new Error('Verified QA fixture battery required');
  const qaId = required(env, 'QA_ENVIRONMENT_ID');
  const runId = required(env, 'SHIPLIGHT_RUN_ID');
  if (!/^qa-[a-zA-Z0-9_-]{1,80}$/.test(qaId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(runId) ||
    !runId.startsWith(`${qaId}-${config.suite}-`)) {
    throw new Error('Module journeys require an exact installer-owned run namespace');
  }
  const expiresAt = required(env, 'QA_EXPIRES_AT');
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) - now < 1_200_000) {
    throw new Error('Module journeys require 20 minutes before QA expiry');
  }
  const backend = validateOrigin(required(env, 'TEST_SUPABASE_URL'), 'local');
  const key = required(env, 'TEST_SUPABASE_ANON_KEY');
  if (!key.startsWith('sb_publishable_')) {
    let role: unknown;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Reject below. */ }
    if (role !== 'anon') throw new Error('Module journeys require a public Supabase key');
  }
  return { ...config, qaId, runId, expiresAt, backend, key };
}