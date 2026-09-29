/** Pure event policy; deployment URLs are checked, never accepted as test targets. */
function ciPolicy(eventName, event, config) {
  const fail = message => { throw new Error(message); };
  if (event.repository?.full_name !== config.repository) fail('Repository mismatch');
  const branch = event.repository?.default_branch;
  if (!branch) fail('Missing default branch');
  let target, suite, deployedSha;
  if (eventName === 'deployment_status') {
    const deployment = event.deployment;
    const status = event.deployment_status;
    if (status?.state !== 'success') fail('Deployment is not successful');
    if (!config.deploymentEnvironment || deployment?.environment !== config.deploymentEnvironment) fail('Untrusted deployment environment');
    if (!config.deploymentCreator || deployment?.creator?.login !== config.deploymentCreator || status.creator?.login !== config.deploymentCreator) fail('Untrusted deployment creator');
    if (deployment.transient_environment || !deployment.production_environment) fail('Not a durable production deployment');
    if (deployment.ref !== branch && deployment.ref !== `refs/heads/${branch}` && deployment.ref !== deployment.sha) fail('Untrusted deployment ref');
    let url;
    try { url = new URL(status.environment_url); } catch { fail('Invalid deployment URL'); }
    if (url.origin !== 'https://app.makinari.com' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) fail('Untrusted deployment URL');
    target = 'production'; suite = 'smoke'; deployedSha = deployment.sha;
  } else if (eventName === 'workflow_dispatch') {
    if (config.ref !== `refs/heads/${branch}`) fail('Manual live tests must run from the default branch');
    target = event.inputs?.target;
    suite = event.inputs?.suite;
    deployedSha = event.inputs?.deployed_sha;
    if (!['production', 'staging'].includes(target) || !['smoke', 'regression'].includes(suite)) fail('Invalid manual selection');
    if (target === 'production' && suite !== 'smoke') fail('Production is read-only smoke');
  } else fail('Unsupported live-test event');
  if (!/^[a-f0-9]{40}$/i.test(deployedSha || '')) fail('A full deployed commit SHA is required');
  return { target, suite, deployedSha, branch, environment: `e2e-${target}` };
}
module.exports = { ciPolicy };