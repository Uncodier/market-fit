import { test, expect } from '../support/records-fixtures';
import { createRecordUI, recordsList, reloadRecord, saveRecord } from '../support/records-ui';

test('cancelling record deletion retains the populated entity after navigation and reload', async ({ page, records }) => {
  const category = await records.category([{ id: 'n', name: 'quantity', label: 'Quantity', type: 'number' }]);
  const subject = await createRecordUI(page, records, category);
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('0');
  await saveRecord(page, records, subject.id, { data: { quantity: 0 } });
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  const before = await records.read('records', subject.id);

  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Delete Record', exact: true });
  await expect(confirmation).toContainText('This record will move to Trash.');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/records/${subject.id}$`));
  await expect(page.getByPlaceholder('Record Title', { exact: true })).toHaveValue(subject.title);
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('0');
  expect(await records.read('records', subject.id)).toEqual(before);

  await recordsList(page);
  await page.goto(`/records/${subject.id}`);
  await expect(page.getByPlaceholder('Record Title', { exact: true })).toHaveValue(subject.title);
  await reloadRecord(page, subject.title);
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('0');
  expect(await records.read('records', subject.id)).toEqual(before);
});