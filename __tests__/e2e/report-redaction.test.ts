/** @jest-environment node */
import { redactApiStepTitle, redactReportText } from '../../tests/support/report-redaction';

it('redacts passwords and escaped occurrences without altering ordinary project evidence', () => {
  const env = { TEST_ADMIN_PASSWORD: 'secret-test-password', TEST_SITE_NAME: 'Synthetic fixture', SHIPLIGHT_API_TOKEN: 'token-test-only' };
  expect(redactReportText('Fill "secret-test-password" Synthetic fixture token-test-only', env))
    .toBe('Fill "[REDACTED]" Synthetic fixture [REDACTED]');
  expect(redactReportText('secret-test-password secret-test-password', env)).toBe('[REDACTED] [REDACTED]');
});
it('handles absent/short secrets and overlapping values without leaking the longest', () => {
  expect(redactReportText('long-secret-value', { A_SECRET: 'long-secret', B_PASSWORD: 'long-secret-value', C_TOKEN: '', D_SECRET: 'a' }))
    .toBe('[REDACTED]');
});
it('redacts ephemeral account-journey passwords registered in the isolated worker environment', () => {
  const env = { TEST_ACCOUNT_INITIAL_PASSWORD: 'synthetic-initial', TEST_ACCOUNT_LOGIN_PASSWORD: 'synthetic-login',
    TEST_ACCOUNT_REPLACEMENT_PASSWORD: 'synthetic-replacement' };
  expect(redactReportText('fill synthetic-initial; fill synthetic-login; fill synthetic-replacement', env))
    .toBe('fill [REDACTED]; fill [REDACTED]; fill [REDACTED]');
});
it('redacts native fill titles without knowing a worker-generated password', () => {
  expect(redactApiStepTitle('Fill "unregistered-worker-password" locator(input[name=password])', 'pw:api')).toBe('Fill [REDACTED]');
  expect(redactApiStepTitle('locator.fill with unregistered-worker-password', 'pw:api')).toBe('Fill [REDACTED]');
  expect(redactApiStepTitle('Verify Synthetic fixture', 'test.step')).toBe('Verify Synthetic fixture');
});
it('redacts all bearer query credentials without removing action types or evidence paths', () => {
  expect(redactReportText('Navigate http://localhost:3000/auth/confirm?token_hash=secret&type=recovery&code=one-time#done'))
    .toBe('Navigate http://localhost:3000/auth/confirm?token_hash=[REDACTED]&type=recovery&code=[REDACTED]#done');
});