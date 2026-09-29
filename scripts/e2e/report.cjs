const c = require('./common.cjs');

function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--run-id')) throw new Error('Use --run-id <id>; historical discovery/merge is forbidden');
  const p = c.paths(args[1] || process.env.SHIPLIGHT_RUN_ID);
  const manifest = c.read(p.manifest);
  const summary = c.read(p.summary);
  if (manifest.mode !== 'run' || manifest.runId !== c.path.basename(p.dir)) throw new Error('Only this exact executed run can be published');
  if (summary.cloud.status === 'confirmed') throw new Error('This run was already published');
  const attemptedAt = new Date().toISOString();
  try {
    if (!process.env.SHIPLIGHT_API_TOKEN) throw new Error('SHIPLIGHT_API_TOKEN is required for cloud publication');
    // The installed CLI reads some metadata from the current checkout, not the report.
    if (c.git('rev-parse', 'HEAD') !== manifest.testSha) throw new Error('Publish from the original test checkout to avoid incorrect Cloud git metadata');
    if (!summary.vendorReportSha256 || c.digest(p.vendor) !== summary.vendorReportSha256) throw new Error('Vendor report is missing or changed since this run');
    const vendor = c.read(p.vendor);
    if (!Array.isArray(vendor.tests) || !vendor.tests.length) throw new Error('Vendor report contains no results');
    for (const test of vendor.tests) for (const attempt of [test, ...(test.attempts || [])]) {
      const files = [attempt.videoPath, attempt.tracePath, ...(attempt.steps || []).map(step => step.screenshot)].filter(Boolean);
      for (const file of files) {
        const absolute = c.path.resolve(p.dir, file);
        if (!absolute.startsWith(p.dir + c.path.sep) || !c.fs.existsSync(absolute) ||
          !c.fs.realpathSync(absolute).startsWith(c.fs.realpathSync(p.dir) + c.path.sep)) {
          throw new Error('Vendor artifact is missing or outside this exact run directory');
        }
      }
    }
    const trigger = `${process.env.GITHUB_ACTIONS ? 'GitHub' : 'Manual'}:${manifest.target}:${manifest.suite}:${summary.scope || 'incomplete'}:${summary.healthGreen ? 'healthy' : 'not-healthy'}:${manifest.runId}`;
    const env = { ...process.env, SHIPLIGHT_REPORT_TO_CLOUD: '1', SHIPLIGHT_RUN_ID: manifest.runId,
      SHIPLIGHT_GIT_SHA: manifest.testSha || '', SHIPLIGHT_GIT_BRANCH: manifest.branch || '', SHIPLIGHT_TELEMETRY: '0', DO_NOT_TRACK: '1', npm_config_offline: 'true' };
    const result = c.command(c.cli, ['report', p.dir, '--trigger', trigger], env, true);
    const receipt = c.model.cloudReceipt((result.stdout || '') + '\n' + (result.stderr || ''), result.status ?? 1, vendor.tests.length);
    // Do not print raw vendor errors: HTTP error bodies may expose credentials or data.
    summary.cloud = { status: receipt.confirmed ? 'confirmed' : 'failed', attemptedAt, url: receipt.url, trigger, warning: receipt.warning };
    if (!receipt.confirmed) throw new Error('Cloud publication not confirmed, or one or more artifacts/metrics were omitted');
    console.log(`Cloud report: ${receipt.url}`);
  } catch (error) {
    summary.cloud = { ...summary.cloud, status: 'failed', attemptedAt, error: error.message };
    throw error;
  } finally {
    c.write(p.summary, summary);
    const counts = summary.counts || { passed: 0, flaky: 0, failed: 0, skipped: 0, blocked: manifest.selected.length };
    if (process.env.GITHUB_STEP_SUMMARY) c.fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n## ${manifest.target} / ${manifest.suite}\nRun: \`${manifest.runId}\` — ${summary.scope}, ${summary.selectedCount}/${summary.expectedCount} selected\n\n` +
      `Suite health: **${summary.healthGreen ? 'green' : 'not green'}**. Cloud: **${summary.cloud.status}**.\n\n` +
      `Passed ${counts.passed}; flaky ${counts.flaky}; failed ${counts.failed}; skipped ${counts.skipped}; blocked ${counts.blocked}.\n\n` +
      'Cloud target classification is vendor-local; use the target/suite trigger and run-manifest.json, not the Cloud target label.\n');
  }
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }