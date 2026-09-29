import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { readEnvironment, required, storageStatePath } from './environment';
import { dismissConsent } from './workspace';

export async function authenticate(page: Page, role: 'admin' | 'buyer'): Promise<void> {
  const config = readEnvironment();
  const statePath = storageStatePath(role);
  await rm(statePath, { force: true });
  const prefix = `TEST_${role.toUpperCase()}`;
  const email = required(process.env, `${prefix}_EMAIL`);
  const password = required(process.env, `${prefix}_PASSWORD`);
  const origin = role === 'buyer' ? config.commerceBaseURL : config.baseURL;
  const response = await page.goto(`${origin}/auth`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'The actual sign-in page must be available').toBe(true);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await dismissConsent(page);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return url.origin === origin && (role === 'buyer' ? url.pathname === '/buyer' : ['/projects', '/robots'].includes(url.pathname));
  }, { message: 'Password login must complete on the correct host; MFA is not bypassed', timeout: 45_000 }).toBe(true);
  await dismissConsent(page);
  await mkdir(path.dirname(statePath), { recursive: true });
  await page.context().storageState({ path: statePath });
}