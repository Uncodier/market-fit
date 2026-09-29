import { test, expect } from '@playwright/test';
import { readEnvironment, required, requiredUuid } from '../support/environment';
import { dismissConsent } from '../support/workspace';
import { startReadObservation, assertReadObservation } from '../support/read-observation';

test.beforeEach(async ({ page }) => { startReadObservation(page); });
test.afterEach(async ({ page }) => { await assertReadObservation(page); });

test('anonymous commerce host serves the configured public product', async ({ page }) => {
  const { commerceBaseURL } = readEnvironment();
  const itemId = requiredUuid(process.env, 'TEST_CATALOG_ITEM_ID');
  const itemName = required(process.env, 'TEST_CATALOG_ITEM_NAME');
  const response = await page.goto(`${commerceBaseURL}/marketplace/${itemId}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  expect(new URL(page.url()).origin).toBe(commerceBaseURL);
  await dismissConsent(page);
  await expect(page.getByRole('heading', { name: itemName, exact: true })).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('anonymous storefront reads a real fixture through the commerce host', async ({ page }) => {
  const { commerceBaseURL } = readEnvironment();
  const slug = encodeURIComponent(required(process.env, 'TEST_SHOP_SLUG'));
  const itemName = required(process.env, 'TEST_CATALOG_ITEM_NAME');
  const response = await page.goto(`${commerceBaseURL}/shop/${slug}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  expect(new URL(page.url()).origin).toBe(commerceBaseURL);
  await dismissConsent(page);
  await expect(page.getByText(itemName, { exact: true }).first()).toBeVisible();
});

test('anonymous workspace navigation requires authentication on the app host', async ({ page }) => {
  const { baseURL } = readEnvironment();
  await page.goto(`${baseURL}/projects`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).pathname).toBe('/auth');
  expect(new URL(page.url()).origin).toBe(baseURL);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});