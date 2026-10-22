/** @jest-environment node */
import { redactReportText } from '../../tests/support/report-redaction';

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