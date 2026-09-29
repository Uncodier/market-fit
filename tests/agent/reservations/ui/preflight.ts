import fs from 'node:fs';
import { targetEnvDefaults } from '../../agent-evidence';
import { required } from '../../../support/environment';
import { createRequire } from 'node:module';
import path from 'node:path';

export default async function preflight() {
  targetEnvDefaults(required(process.env, 'TEST_TARGET'));
  if (!fs.existsSync(required(process.env, 'TEST_AGENT_STORAGE_STATE'))) throw new Error('Missing isolated agent auth state');
  required(process.env, 'AGENT_VERIFICATION_RUN_ID');
  required(process.env, 'TEST_PROJECT_ROOT');
  const rootRequire = createRequire(path.resolve(__dirname, '../../../../package.json'));
  const localRequire = createRequire(path.resolve(__dirname, 'package.json'));
  if (rootRequire('shiplightai/package.json').version !== localRequire('shiplightai/package.json').version) {
    throw new Error('[E2E_BLOCKED] Nested Shiplight version differs from the repository runner; align dependencies before agent execution');
  }
}