import path from 'node:path';
import { defineConfig, shiplightConfig } from 'shiplightai';

const root = path.resolve(__dirname, '../../../..');
export default defineConfig({
  ...shiplightConfig(),
  testDir: './tests',
  testMatch: '*.yaml.spec.ts',
  globalSetup: './preflight.ts',
  workers: 1,
  retries: 0,
  timeout: 300_000,
  use: {
    baseURL: process.env.TEST_BASE_URL,
    storageState: process.env.TEST_AGENT_STORAGE_STATE || path.join(root, '.auth/missing-agent-state.json'),
    trace: 'retain-on-failure', video: 'retain-on-failure', screenshot: 'only-on-failure',
  },
});