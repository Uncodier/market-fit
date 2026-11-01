import { test, expect } from '@playwright/test';
import {
  assertSelectedCustomer, crossflowFixture, gotoCrossflow, openExactLead, readPosSession,
} from '../support/subsystem-crossflows';

test('POS searches the exact QA lead and preserves customer UUID across reload and CRM roundtrip', async ({ page }) => {
  const fixture = await crossflowFixture(page);
  await gotoCrossflow(page, '/pos');
  const select = page.getByRole('button', { name: 'Select a customer', exact: true }).filter({ visible: true });
  await expect(select).toHaveCount(1);
  await expect(select).toBeVisible();
  await expect.poll(async () => (await readPosSession(page, fixture.siteId))?.activeOrderId).toBe('new');
  const initial = await readPosSession(page, fixture.siteId);
  expect(initial?.cart, 'Use a fresh browser cart; never overwrite an existing basket').toEqual([]);
  expect(initial?.leadValue).toBeNull();
  await select.click();
  const picker = page.getByRole('dialog', { name: 'Select a customer', exact: true });
  await expect(picker).toBeVisible();
  await picker.getByPlaceholder('Search by name, email, or phone...', { exact: true }).fill(fixture.lead.name);
  await expect(picker.getByRole('status'), 'Online customer search must finish without a local-cache fallback error').toHaveCount(0);
  const customer = picker.getByRole('button').filter({ has: page.getByText(fixture.lead.name, { exact: true }) });
  await expect(customer, 'The exact customer must be unique, not the first fuzzy result').toHaveCount(1);
  if (fixture.lead.email) await expect(customer).toContainText(fixture.lead.email);
  await customer.click();
  await expect(picker).toBeHidden();
  await assertSelectedCustomer(page, fixture);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(select).toBeVisible();
  await assertSelectedCustomer(page, fixture);
  // Verify restored selection is actually rendered by reopening the genuine picker.
  await select.click();
  await expect(picker).toBeVisible();
  await picker.getByPlaceholder('Search by name, email, or phone...', { exact: true }).fill(fixture.lead.name);
  await expect(picker.getByRole('status')).toHaveCount(0);
  await expect(customer).toHaveCount(1);
  // Shared icons render their class on IconWrapper's span, not the child SVG.
  const selectedCheck = customer.locator('.text-primary');
  await expect(selectedCheck, 'The exact customer must retain one selected checkmark wrapper').toHaveCount(1);
  await expect(selectedCheck).toBeVisible();
  await expect(selectedCheck.locator('svg')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();

  await openExactLead(page, fixture);
  await gotoCrossflow(page, '/pos');
  await expect(select).toBeVisible();
  await assertSelectedCustomer(page, fixture);
  // No Save, New Order, Send, payment, reservation, lead edit or fixture deletion.
});