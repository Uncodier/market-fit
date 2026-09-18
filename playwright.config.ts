import { defineConfig, shiplightConfig } from 'shiplightai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const ADMIN_STORAGE_STATE_PATH = '.auth/admin.json';

export default defineConfig({
  ...shiplightConfig(),
  testDir: '.',
  testMatch: ['**/*.yaml.spec.ts'],
  timeout: 300_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15_000,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
    // executablePath removed
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
      use: {
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'admin',
      testIgnore: /browser-quality-mobile.*\.yaml\.spec\.ts/,
      use: {
        storageState: ADMIN_STORAGE_STATE_PATH,
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chromium',
      testMatch: /browser-quality-mobile.*\.yaml\.spec\.ts/,
      use: {
        browserName: 'chromium',
        storageState: ADMIN_STORAGE_STATE_PATH,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },
    /*
    {
      name: 'marketing',
      use: {
        storageState: '.auth/marketing.json',
      },
      dependencies: ['setup'],
    }
    */
  ],
});