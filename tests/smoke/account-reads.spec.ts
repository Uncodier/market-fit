import { test, expect, type Page } from '@playwright/test';
import { selectWorkspace, dismissConsent } from '../support/workspace';
import { startReadObservation, assertReadObservation, waitForObservedReads } from '../support/read-observation';

test.beforeEach(async ({ page }) => { startReadObservation(page); });
test.afterEach(async ({ page }) => { await assertReadObservation(page); });

async function openAccount(page: Page, route: string) {
  await selectWorkspace(page);
  await waitForObservedReads(page);
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await dismissConsent(page);
  await expect(page).toHaveURL(url => url.pathname === route);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
}

test('Account search finishes a real no-match query and restores the empty prompt', async ({ page }) => {
  await openAccount(page, '/home/search');
  await expect(page.getByRole('heading', { name: 'Search results', exact: true })).toBeVisible();
  const input = page.getByPlaceholder('Search all collections...', { exact: true });
  await expect(page.getByText('Search all collections', { exact: true })).toBeVisible();
  await input.fill(`e2e-no-match-${process.env.SHIPLIGHT_RUN_ID}`);
  await expect(page.getByText('No matching results', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0);
  await input.fill('');
  await expect(page.getByText('Search all collections', { exact: true })).toBeVisible();
});

test('Personal credentials reads private evidence without uploading or archiving', async ({ page }) => {
  await openAccount(page, '/home/profile');
  await expect(page.getByRole('heading', { name: 'Private credentials', exact: true })).toBeVisible();
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0, { timeout: 45_000 });
  await waitForObservedReads(page);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload credential', exact: true })).toBeVisible();
});