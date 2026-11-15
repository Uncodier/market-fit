import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { assertSelectedCustomer, crossflowFixture, gotoCrossflow, openExactLead, readPosSession } from '../support/subsystem-crossflows';

test('cancelling a POS customer draft creates no lead and retains the selected customer', async ({ page }) => {
  const fixture = await crossflowFixture(page);
  await gotoCrossflow(page, '/pos');
  const select = page.getByRole('button', { name: 'Select a customer', exact: true }).filter({ visible: true });
  await expect(select).toHaveCount(1);
  await expect.poll(async () => (await readPosSession(page, fixture.siteId))?.activeOrderId).toBe('new');
  const initial = await readPosSession(page, fixture.siteId);
  expect(initial?.cart, 'Never overwrite an existing basket').toEqual([]);
  expect(initial?.leadValue).toBeNull();
  await select.click();
  const picker = page.getByRole('dialog', { name: 'Select a customer', exact: true });
  await picker.getByPlaceholder('Search by name, email, or phone...', { exact: true }).fill(fixture.lead.name);
  const customer = picker.getByRole('button').filter({ has: page.getByText(fixture.lead.name, { exact: true }) });
  await expect(customer).toHaveCount(1);
  await expect(picker.getByRole('status')).toHaveCount(0);
  await customer.click();
  await expect(picker).toBeHidden();
  await assertSelectedCustomer(page, fixture);

  const draftName = `${process.env.SHIPLIGHT_RUN_ID} cancelled customer ${randomUUID()}`;
  const draftEmail = `cancelled-${randomUUID()}@${process.env.QA_ENVIRONMENT_ID}.invalid`;
  const readDraft = () => fixture.client.from('leads').select('id')
    .eq('site_id', fixture.siteId).eq('name', draftName);
  const absent = await readDraft();
  expect(absent.error).toBeNull();
  expect(absent.data).toEqual([]);
  await select.click();
  await picker.getByRole('tab', { name: 'Create', exact: true }).click();
  await picker.getByPlaceholder('Name', { exact: true }).fill(draftName);
  await picker.getByPlaceholder('Email', { exact: true }).fill(draftEmail);
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(picker).toBeHidden();
  await assertSelectedCustomer(page, fixture);

  await select.click();
  await expect(picker.getByRole('tab', { name: 'Search', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(picker.getByPlaceholder('Search by name, email, or phone...', { exact: true })).toHaveValue('');
  await picker.getByRole('tab', { name: 'Create', exact: true }).click();
  await expect(picker.getByPlaceholder('Name', { exact: true })).toHaveValue('');
  await expect(picker.getByPlaceholder('Email', { exact: true })).toHaveValue('');
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(picker).toBeHidden();
  await openExactLead(page, fixture);
  await gotoCrossflow(page, '/pos');
  await expect(select).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(select).toBeVisible();
  await assertSelectedCustomer(page, fixture);
  const stillAbsent = await readDraft();
  expect(stillAbsent.error).toBeNull();
  expect(stillAbsent.data).toEqual([]);
  // No Create Customer, order, payment, lead write or deletion is authorized here.
});