import { test, expect, type Page } from '@playwright/test';
import { selectWorkspace, assertWorkspace, dismissConsent } from '../support/workspace';
import { startReadObservation, assertReadObservation, waitForObservedReads } from '../support/read-observation';
import translations from '../../app/context/locales/en.json';

test.beforeEach(async ({ page }) => { startReadObservation(page); });
test.afterEach(async ({ page }) => { await assertReadObservation(page); });

async function openVisit(page: Page, route: string) {
  await selectWorkspace(page);
  await waitForObservedReads(page);
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await dismissConsent(page);
  const card = page.locator('.visit-slide-card').filter({
    has: page.getByRole('heading', { name: translations['visits.steps.identity.title'], exact: true }),
  });
  await expect(card).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0);
  await assertWorkspace(page);
  return card;
}

test('Visits loads the kiosk and prevents advancing without visitor identity', async ({ page }) => {
  const card = await openVisit(page, '/visits');
  await expect(card.locator('input[autocomplete="name"]')).toHaveValue('');
  await expect(card.locator('input[type="email"]')).toHaveValue('');
  await expect(card.getByRole('button', { name: translations['visits.actions.continue'], exact: true })).toBeDisabled();
});

test('Visits validates malformed contacts and unlocks only a valid unsaved identity', async ({ page }) => {
  const card = await openVisit(page, '/visits');
  const next = card.getByRole('button', { name: translations['visits.actions.continue'], exact: true });
  const email = card.locator('input[type="email"]');
  const phone = card.locator('input[autocomplete="tel"]');
  await card.locator('input[autocomplete="name"]').fill('E2E Unsaved Visitor');
  await expect(next).toBeDisabled();
  await email.fill('invalid-email');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(next).toBeDisabled();
  await email.fill('unsaved-visitor@example.invalid');
  await expect(email).toHaveAttribute('aria-invalid', 'false');
  await expect(next).toBeEnabled();
  await phone.fill('abc');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(next).toBeDisabled();
  await phone.fill('');
  await expect(next).toBeEnabled();
  // Never click Complete visit, grant camera access, upload identity or submit.
  await email.fill('');
  await expect(next).toBeDisabled();
});