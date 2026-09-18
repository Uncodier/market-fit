import { mkdir, rm } from 'node:fs/promises';
import { test as setup } from '@playwright/test';

const ADMIN_STORAGE_STATE_PATH = '.auth/admin.json';

setup('authenticate admin', async ({ page }) => {
  await rm(ADMIN_STORAGE_STATE_PATH, { force: true });

  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    const missingVariables = [
      !email ? 'TEST_ADMIN_EMAIL' : null,
      !password ? 'TEST_ADMIN_PASSWORD' : null,
    ].filter(Boolean);
    throw new Error(
      `Admin E2E authentication requires ${missingVariables.join(' and ')}. ` +
      `The stale ${ADMIN_STORAGE_STATE_PATH} state was removed.`,
    );
  }

  // Always create a fresh authenticated state for this run.
  await page.goto('/auth');

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForURL('**/projects*');

  await mkdir('.auth', { recursive: true });
  await page.context().storageState({ path: ADMIN_STORAGE_STATE_PATH });
});
