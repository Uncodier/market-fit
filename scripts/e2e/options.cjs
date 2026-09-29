function runId(value) {
  if (!value || !/^[a-zA-Z0-9_-]{1,100}$/.test(value) || value === 'latest') throw new Error('An explicit safe run ID is required (not latest)');
  return value;
}
function parseArgs(args, env = process.env) {
  const result = { suite: env.TEST_SUITE || 'smoke', target: env.TEST_TARGET || null, list: false, validate: false, headed: false, grep: null };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (['--list', '--validate', '--headed'].includes(flag)) result[flag.slice(2)] = true;
    else if (['--suite', '--target', '--grep'].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      result[flag.slice(2)] = value;
    } else throw new Error(`Unsupported option: ${flag}. Allowed: --suite --target --list --validate --grep --headed`);
  }
  if (!['smoke', 'regression', 'buyer', 'roles'].includes(result.suite)) throw new Error('Invalid suite');
  if (result.target && !['local', 'staging', 'production'].includes(result.target)) throw new Error('Invalid target');
  if (result.list && result.validate) throw new Error('Choose --list or --validate');
  if (result.grep) new RegExp(result.grep);
  return result;
}
module.exports = { runId, parseArgs };