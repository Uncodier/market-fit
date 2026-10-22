import { defineConfig, shiplightConfig } from 'shiplightai';
import dotenv from 'dotenv';
import path from 'node:path';
import { storageStatePath, type TestSuite } from './tests/support/environment';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), quiet: true });

const suite = (process.env.TEST_SUITE || 'smoke') as TestSuite;
if (!['smoke', 'regression', 'buyer', 'roles', 'project-lifecycle'].includes(suite)) throw new Error('Invalid TEST_SUITE');
const generated = shiplightConfig();
const safeReporters = Array.isArray(generated.reporter) ? generated.reporter.map(entry =>
  Array.isArray(entry) && entry[0] === 'shiplightai/reporter'
    ? [path.join(__dirname, 'tests/support/safe-shiplight-reporter.ts'), entry[1]] as [string, object]
    : entry) : generated.reporter;
const shared = { browserName: 'chromium' as const };
const adminState = storageStatePath('admin');
const projects = suite === 'roles' ? [{ name: 'roles', testMatch: /tests\/boundaries\/.*\.spec\.ts$/ }]
  : suite === 'project-lifecycle' ? [
    { name: 'setup', testMatch: /(^|\/)auth\.setup\.ts$/, use: { storageState: { cookies: [], origins: [] } } },
    { name: 'project-lifecycle', testMatch: /tests\/projects\/lifecycle\.spec\.ts$/, use: { ...shared, storageState: adminState }, dependencies: ['setup'] },
  ] : suite === 'buyer' ? [
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
  reporter: safeReporters,
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
    // Archival reauthenticates with an account password; never record this suite.
    video: suite === 'project-lifecycle' ? 'off' : 'retain-on-failure',
    screenshot: suite === 'project-lifecycle' ? 'off' : 'only-on-failure',
    trace: suite === 'project-lifecycle' ? 'off' : 'retain-on-failure',
  },
  projects,
});