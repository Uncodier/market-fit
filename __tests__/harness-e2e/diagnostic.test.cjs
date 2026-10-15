const { canActivate, diagnosticComplete } = require('../../scripts/harness-e2e/run.cjs');
it('diagnostic mode only tolerates unavailable file-oracle access, not missing funding', () => {
  expect(canActivate({ passed: false, blockers: ['sandboxAccess'] }, true)).toBe(true);
  expect(canActivate({ passed: false, blockers: ['sandboxAccess'] }, false)).toBe(false);
  expect(canActivate({ passed: false, blockers: ['funded', 'sandboxAccess'] }, true)).toBe(false);
});
it('does not classify a task as diagnostically complete without real terminal and transcript evidence', () => {
  const checks = [{ name: 'terminal_completed', passed: true }, { name: 'evidence_complete', passed: true },
    { name: 'independent_exact_files', passed: false }];
  expect(diagnosticComplete({ checks })).toBe(true);
  expect(diagnosticComplete({ checks: [...checks, { name: 'assertion_failure_then_same_test_pass', passed: false }] })).toBe(false);
  expect(diagnosticComplete({ checks: [] })).toBe(false);
});