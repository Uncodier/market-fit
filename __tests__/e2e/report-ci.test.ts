/** @jest-environment node */
const { ciPolicy } = require('../../scripts/e2e/ci-policy.cjs');

const sha = 'a'.repeat(40);
const config = { repository: 'owner/repo', ref: 'refs/heads/main', deploymentEnvironment: 'Production', deploymentCreator: 'deploy-bot' };
const event = () => ({
  repository: { full_name: 'owner/repo', default_branch: 'main' },
  deployment: { environment: 'Production', production_environment: true, transient_environment: false, ref: 'main', sha, creator: { login: 'deploy-bot' } },
  deployment_status: { state: 'success', environment_url: 'https://app.makinari.com', creator: { login: 'deploy-bot' } },
  inputs: { target: 'staging', suite: 'regression', deployed_sha: sha },
});

describe('protected live CI events', () => {
  it('turns trusted deployments into production smoke only', () => {
    expect(ciPolicy('deployment_status', event(), config)).toMatchObject({ target: 'production', suite: 'smoke', deployedSha: sha });
  });
  it('allows manual staging regression from trusted branch', () => {
    expect(ciPolicy('workflow_dispatch', event(), config)).toMatchObject({ target: 'staging', suite: 'regression' });
    expect(() => ciPolicy('workflow_dispatch', event(), { ...config, ref: 'refs/heads/untrusted' })).toThrow();
    const e = event(); e.inputs.target = 'production';
    expect(() => ciPolicy('workflow_dispatch', e, config)).toThrow('read-only');
  });
  it.each(['https://evil.example', 'https://app.makinari.com.evil.example', 'https://user:pass@app.makinari.com', 'https://app.makinari.com/?token=secret', 'http://app.makinari.com'])('rejects deployment URL %s', url => {
    const e = event(); e.deployment_status.environment_url = url;
    expect(() => ciPolicy('deployment_status', e, config)).toThrow();
  });
  it('rejects spoofed environments, creator, ref and malformed SHA', () => {
    for (const change of [
      (e: any) => { e.deployment.environment = 'Preview'; },
      (e: any) => { e.deployment.creator.login = 'attacker'; },
      (e: any) => { e.deployment_status.creator.login = 'attacker'; },
      (e: any) => { e.deployment.ref = 'feature'; },
      (e: any) => { e.deployment.sha = 'main'; },
      (e: any) => { e.repository.full_name = 'attacker/fork'; },
      (e: any) => { e.deployment_status.state = 'failure'; },
    ]) {
      const e = event(); change(e);
      expect(() => ciPolicy('deployment_status', e, config)).toThrow();
    }
    expect(() => ciPolicy('pull_request', event(), config)).toThrow();
  });
});