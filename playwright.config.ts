import { defineConfig, shiplightConfig } from 'shiplightai';
import dotenv from 'dotenv';
import path from 'node:path';
import { storageStatePath, type TestSuite } from './tests/support/environment';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), quiet: true });

const suite = (process.env.TEST_SUITE || 'smoke') as TestSuite;
if (!['smoke', 'regression', 'buyer', 'roles'].includes(suite)) throw new Error('Invalid TEST_SUITE');
const generated = shiplightConfig();
const shared = { browserName: 'chromium' as const };
const adminState = storageStatePath('admin');
const projects = suite === 'roles' ? [{ name: 'roles', testMatch: /tests\/boundaries\/.*\.spec\.ts$/ }]
  : suite === 'buyer' ? [
    { name: 'buyer-setup', testMatch: /tests\/auth\/buyer\.setup\.ts$/, use: { storageState: { cookies: [], origins: [] } } },
    { name: 'buyer', testMatch: /tests\/buyer-navigation\.yaml\.spec\.ts$/, use: { ...shared, baseURL: process.env.TEST_COMMERCE_BASE_URL, storageState: storageStatePath('buyer') }, dependencies: ['buyer-setup'] },
  ] : [
    { name: 'setup', testMatch: /(^|\/)auth\.setup\.ts$/, use: { storageState: { cookies: [], origins: [] } } },
    { name: 'public', testMatch: suite === 'smoke' ? /tests\/smoke\/public\.spec\.ts$/ : /tests\/public-commerce-navigation\.yaml\.spec\.ts$/, use: { ...shared, baseURL: process.env.TEST_COMMERCE_BASE_URL, storageState: { cookies: [], origins: [] } } },
    { name: 'admin', testMatch: suite === 'smoke' ? /tests\/smoke\/workspace\.spec\.ts$/ : path.join(__dirname, 'tests/*.yaml.spec.ts'), testIgnore: ['**/tests/agent/**', /(?:example|browser-quality-mobile|buyer-navigation|public-commerce-navigation)\.yaml\.spec\.ts$/], use: { ...shared, storageState: adminState }, dependencies: ['setup'] },
    ...(suite === 'regression' ? [{ name: 'mobile-chromium', testMatch: /tests\/browser-quality-mobile\.yaml\.spec\.ts$/, use: { ...shared, storageState: adminState, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, dependencies: ['setup'] }] : []),
  ];

export default defineConfig({
  ...generated,
  testDir: '.',
  testIgnore: ['**/node_modules/**', '**/tests/agent/**', '**/arch.yaml.spec.ts'],
  globalSetup: './tests/support/preflight.ts',
  timeout: suite === 'smoke' ? 90_000 : 300_000,
  globalTimeout: suite === 'smoke' ? 600_000 : 7_200_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  metadata: {
    target: process.env.TEST_TARGET || 'unconfigured',
    suite,
    appOrigin: process.env.TEST_BASE_URL || 'unconfigured',
    commerceOrigin: process.env.TEST_COMMERCE_BASE_URL || 'unconfigured',
    deployedSha: process.env.TEST_DEPLOYED_SHA || 'unknown',
  },
  use: {
    baseURL: process.env.TEST_BASE_URL,
    headless: true,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects,
});