// Local observer only. Safe for an external cron: one read-only sample per invocation.
// Never seeds/activates work, calls the production cron, or installs an OS schedule.
const { main } = require('./run.cjs');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--run-id' || !/^[a-z0-9-]{8,80}$/.test(args[1])) {
  console.error('Usage: node scripts/harness-e2e/cron.cjs --run-id RUN_ID'); process.exitCode = 2;
} else {
  main(['observe', '--run-id', args[1], '--ack-observer-service-role']).catch(() => {
    console.error('Observer unavailable, scope changed, or another sampler owns the run; no production work dispatched.'); process.exitCode = 2;
  });
}