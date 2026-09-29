import { test, expect } from '@playwright/test';
import { selectWorkspace, assertWorkspace, dismissConsent } from '../support/workspace';
import { startReadObservation, assertReadObservation } from '../support/read-observation';
import { required } from '../support/environment';

test.beforeEach(async ({ page }) => { startReadObservation(page); });
test.afterEach(async ({ page }) => { await assertReadObservation(page); });

test('the signed-in account can select the exact synthetic workspace', async ({ page }) => {
  await selectWorkspace(page);
  await expect(page.getByRole('main').first()).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('content reads finish without dependency failures in the selected workspace', async ({ page }) => {
  await selectWorkspace(page);
  const response = await page.goto('/content', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  const fixture = required(process.env, 'TEST_CONTENT_NAME');
  const search = page.getByPlaceholder('Search content...').filter({ visible: true }).first();
  await expect(search).toBeVisible();
  await search.fill(fixture);
  await expect(page.getByText(fixture, { exact: true }).first()).toBeVisible();
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0);
  await dismissConsent(page);
  await assertWorkspace(page);
});

test('CRM lead reads finish in the same workspace without a login fallback', async ({ page }) => {
  await selectWorkspace(page);
  const response = await page.goto('/leads', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  const fixture = required(process.env, 'TEST_LEAD_NAME');
  const search = page.getByPlaceholder('Search leads...').filter({ visible: true }).first();
  await expect(search).toBeVisible();
  await search.fill(fixture);
  await expect(page.getByText(fixture, { exact: true }).first()).toBeVisible();
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await assertWorkspace(page);
});