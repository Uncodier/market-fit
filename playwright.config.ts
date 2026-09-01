import { defineConfig, shiplightConfig } from 'shiplightai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

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
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'admin',
      use: {
        storageState: '.auth/admin.json',
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