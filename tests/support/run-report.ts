/** Repository-owned summary. Never rewrites the vendor's report-data.json. */
export type JsonTest = {
  projectName?: string; status?: string;
  results?: { status: string; retry?: number; workerIndex?: number; error?: { message?: string }; errors?: { message?: string }[] }[];
};
export type JsonSuite = {
  title?: string; file?: string; suites?: JsonSuite[];
  specs?: { id?: string; title: string; file: string; line: number; column: number; tests: JsonTest[] }[];
};
export type JsonReport = { suites?: JsonSuite[]; errors?: unknown[] };
export type Case = { key: string; setup: boolean; test: JsonTest };
export type Outcome = 'passed' | 'flaky' | 'failed' | 'skipped' | 'blocked';

export function cases(report: JsonReport): Case[] {
  const found: Case[] = [];
  function visit(suite: JsonSuite, parents: string[]) {
    const titles = [...parents, suite.title || ''];
    for (const spec of suite.specs || []) for (const test of spec.tests) {
      found.push({
        key: JSON.stringify([test.projectName, spec.file.replace(/\\/g, '/'), spec.line, spec.column, ...titles, spec.title]),
        setup: /\.setup\.[cm]?[jt]s$/.test(spec.file), test,
      });
    }
    for (const child of suite.suites || []) visit(child, titles);
  }
  for (const suite of report.suites || []) visit(suite, []);
  return found;
}

export function outcome(test: JsonTest, setupFailed = false): Outcome {
  const results = test.results || [];
  if (results.some(r => [r.error, ...(r.errors || [])].some(error => error?.message?.includes('[E2E_BLOCKED]')))) return 'blocked';
  if (!results.length || results.some(r => r.status === 'interrupted')) return 'blocked';
  const last = results[results.length - 1];
  if (last.status === 'skipped') return setupFailed || last.workerIndex === -1 ? 'blocked' : 'skipped';
  if (last.status !== 'passed') return 'failed';
  if (test.status === 'flaky' || results.length > 1 || results.some(r => (r.retry || 0) > 0)) return 'flaky';
  return test.status === 'unexpected' ? 'failed' : 'passed';
}

export function summarize(expected: string[], selected: string[], report: JsonReport | null, exitCode: number, filtered: boolean, expectedSetup: string[] = []) {
  const all = report ? cases(report) : [];
  const setupCases = all.filter(c => c.setup);
  const setup = setupCases.map(c => outcome(c.test));
  for (const key of expectedSetup) if (!setupCases.some(c => c.key === key)) setup.push('blocked');
  const setupFailed = setup.some(s => s !== 'passed');
  const actual = new Map(all.filter(c => !c.setup).map(c => [c.key, c]));
  const counts: Record<Outcome, number> = { passed: 0, flaky: 0, failed: 0, skipped: 0, blocked: 0 };
  for (const key of selected) counts[actual.has(key) ? outcome(actual.get(key)!.test, setupFailed) : 'blocked']++;
  const missing = selected.filter(key => !actual.has(key)).length;
  const unexpected = [...actual.keys()].filter(key => !selected.includes(key)).length;
  const duplicateResults = all.filter(c => !c.setup).length !== actual.size;
  const full = !filtered && expected.length > 0 && expected.length === selected.length && expected.every(k => selected.includes(k));
  const complete = !!report && selected.length > 0 && !missing && !unexpected && !duplicateResults &&
    !counts.blocked && !counts.skipped && !setupFailed && !(report.errors || []).length;
  return {
    expectedCount: expected.length, selectedCount: selected.length, scope: full ? 'full' : 'partial',
    counts, setup, missing, unexpected, complete,
    healthGreen: full && complete && exitCode === 0 && counts.passed === expected.length && !counts.flaky && !counts.failed,
  };
}

export function cloudReceipt(output: string, exitCode: number, expectedTests: number) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const uploaded = clean.match(/Uploading (\d+) test result\(s\) to Shiplight cloud/);
  const url = clean.match(/Shiplight cloud report: (https:\/\/\S+)/)?.[1] || null;
  const warning = /(?:\[report(?:er)?\].*(?:fail|skipp|excluding|no result|no report|rejected)|cloud upload skipped)/i.test(clean);
  return { confirmed: exitCode === 0 && !!url && Number(uploaded?.[1]) === expectedTests && !warning, url, warning };
}