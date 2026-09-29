/** @jest-environment node */
import { cases, cloudReceipt, outcome, summarize, type JsonReport } from '../../tests/support/run-report';

function report(status = 'passed', file = 'tests/smoke/workspace.spec.ts'): JsonReport {
  return { suites: [{ title: file, specs: [{ title: 'loads real data', file, line: 1, column: 1,
    tests: [{ projectName: 'admin', status: status === 'passed' ? 'expected' : 'unexpected', results: [{ status, workerIndex: 0 }] }],
  }] }] };
}
const keys = (r: JsonReport) => cases(r).filter(c => !c.setup).map(c => c.key);

describe('precise suite health', () => {
  it('accepts only a complete full pass', () => {
    const r = report(), selected = keys(r);
    expect(summarize(selected, selected, r, 0, false).healthGreen).toBe(true);
    expect(summarize(selected, selected, r, 0, true).healthGreen).toBe(false);
    expect(summarize(selected, selected, r, 1, false).healthGreen).toBe(false);
    expect(summarize([], [], { suites: [] }, 0, false).healthGreen).toBe(false);
  });
  it.each(['failed', 'timedOut', 'skipped', 'interrupted'])('rejects %s', status => {
    const r = report(status), selected = keys(r);
    expect(summarize(selected, selected, r, 0, false).healthGreen).toBe(false);
  });
  it('rejects retries, expected failures, missing and unexpected cases', () => {
    expect(outcome({ status: 'flaky', results: [{ status: 'failed' }, { status: 'passed', retry: 1 }] })).toBe('flaky');
    expect(outcome({ status: 'expected', results: [{ status: 'failed' }] })).toBe('failed');
    const r = report(), selected = keys(r);
    expect(summarize(selected, selected, null, 0, false).counts.blocked).toBe(1);
    expect(summarize(selected, selected, { suites: [] }, 0, false).missing).toBe(1);
    expect(summarize(selected, selected, report('passed', 'other.spec.ts'), 0, false).unexpected).toBe(1);
    expect(summarize(selected, selected, { ...r, errors: ['worker crashed'] }, 0, false).healthGreen).toBe(false);
  });
  it('excludes all setup files and blocks dependents when setup fails', () => {
    const r = report('skipped');
    r.suites!.push(...report('failed', 'tests/auth/buyer.setup.ts').suites!);
    expect(cases(r).filter(c => c.setup)).toHaveLength(1);
    expect(summarize(keys(r), keys(r), r, 1, false).counts.blocked).toBe(1);
  });
  it('rejects duplicate results rather than double-counting passes', () => {
    const r = report(), selected = keys(r);
    r.suites!.push(...report().suites!);
    expect(summarize(selected, selected, r, 0, false).healthGreen).toBe(false);
  });
  it('requires every discovered setup and preserves explicit fixture blockers', () => {
    const r = report(), selected = keys(r);
    expect(summarize(selected, selected, r, 0, false, ['missing-setup']).healthGreen).toBe(false);
    expect(outcome({ results: [{ status: 'failed', error: { message: '[E2E_BLOCKED] No approved fixture' } }] })).toBe('blocked');
  });
});

describe('cloud acknowledgement', () => {
  const success = '[reporter] Uploading 2 test result(s) to Shiplight cloud...\nShiplight cloud report: https://app.shiplight.ai/runs/42';
  it('requires acknowledgement and exact uploaded count, not merely exit zero', () => {
    expect(cloudReceipt(success, 0, 2).confirmed).toBe(true);
    expect(cloudReceipt(success, 0, 3).confirmed).toBe(false);
    expect(cloudReceipt('', 0, 2).confirmed).toBe(false);
    expect(cloudReceipt(success, 1, 2).confirmed).toBe(false);
  });
  it.each(['Cloud upload failed', 'Asset upload failed', 'No result slot found', 'Run completion rejected', 'No report S3 URI'])('rejects vendor warning: %s', warning => {
    expect(cloudReceipt(`${success}\n[reporter] ${warning}`, 0, 2).confirmed).toBe(false);
  });
});