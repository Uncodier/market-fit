import { format } from 'date-fns';
import { test, expect } from '../support/records-fixtures';
import { chooseRelation, createNumberCategoryUI, createRecordUI, editCategory, reloadRecord, saveRecord } from '../support/records-ui';

test('UI scalar values persist zero, local date, explicit false, unset and configured enum', async ({ page, records }) => {
  const category = await records.category([
    { id: 'n', name: 'quantity', label: 'Quantity', type: 'number' },
    { id: 'd', name: 'on_date', label: 'On date', type: 'date' },
    { id: 'b', name: 'confirmed', label: 'Confirmed', type: 'boolean' },
    { id: 's', name: 'stage', label: 'Stage', type: 'select', options: ['Ready', 'Waiting'] },
  ]);
  const record = await createRecordUI(page, records, category);
  await expect(page.getByRole('combobox', { name: 'Confirmed', exact: true })).toHaveText('Not set');
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('0');
  // Choose the 15th of the browser's current month, never a relative-time preset.
  const date = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  });
  await page.getByRole('group', { name: 'On date', exact: true }).getByRole('button', { name: 'Empty', exact: true }).click();
  await page.getByRole('button', { name: format(new Date(`${date}T12:00:00`), 'PPPP'), exact: true }).click();
  await page.getByRole('combobox', { name: 'Confirmed', exact: true }).click();
  await page.getByRole('option', { name: 'No', exact: true }).click();
  await page.getByRole('textbox', { name: 'Stage', exact: true }).fill('Unlisted value');
  await expect(page.getByText('Use "Unlisted value"', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Stage', exact: true }).press('Enter');
  await page.keyboard.press('Escape');
  await chooseRelation(page, 'Stage', 'Ready');
  await saveRecord(page, records, record.id, { data: { quantity: 0, on_date: date, confirmed: false, stage: 'Ready' } });
  await reloadRecord(page, record.title);
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('0');
  await expect(page.getByRole('combobox', { name: 'Confirmed', exact: true })).toHaveText('No');
  await expect(page.getByRole('textbox', { name: 'Stage', exact: true })).toHaveValue('Ready');
  await expect(page.getByRole('button', { name: format(new Date(`${date}T12:00:00`), 'PPP'), exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Confirmed', exact: true }).click();
  await page.getByRole('option', { name: 'Not set', exact: true }).click();
  await saveRecord(page, records, record.id, { data: { quantity: 0, on_date: date, confirmed: null, stage: 'Ready' } });
  await reloadRecord(page, record.title);
  await expect(page.getByRole('combobox', { name: 'Confirmed', exact: true })).toHaveText('Not set');
});

test('UI-created template keeps immutable storage key when its populated field label changes', async ({ page, records }) => {
  const category = await createNumberCategoryUI(page, records);
  const record = await createRecordUI(page, records, category);
  await page.getByRole('spinbutton', { name: 'Original quantity', exact: true }).fill('0');
  await saveRecord(page, records, record.id, { data: { quantity: 0 } });
  const dialog = await editCategory(page, category);
  await dialog.getByText('Original quantity', { exact: true }).click();
  await expect(dialog.getByLabel('Field Name (Storage Key)', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Field Name (Storage Key)', { exact: true })).toHaveValue('quantity');
  await dialog.getByLabel('Display Label (Optional)', { exact: true }).fill('Renamed quantity');
  await dialog.getByRole('button', { name: 'Save Template', exact: true }).click();
  await expect(dialog).toBeHidden();
  const persisted = await records.read('record_categories', category.id);
  expect(persisted.template_fields).toEqual([expect.objectContaining({ name: 'quantity', label: 'Renamed quantity', type: 'number' })]);
  expect((await records.read('records', record.id)).data).toEqual({ quantity: 0 });
  await page.goto(`/records/${record.id}`);
  await expect(page.getByRole('spinbutton', { name: 'Renamed quantity', exact: true })).toHaveValue('0');
  await reloadRecord(page, record.title);
  await expect(page.getByRole('spinbutton', { name: 'Renamed quantity', exact: true })).toHaveValue('0');
});

test('UI refuses populated schema retyping without changing persisted schema or values', async ({ page, records }) => {
  const category = await records.category([{ id: 'n', name: 'quantity', label: 'Quantity', type: 'number' }]);
  const record = await createRecordUI(page, records, category);
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('0');
  await saveRecord(page, records, record.id, { data: { quantity: 0 } });
  const dialog = await editCategory(page, category);
  await dialog.getByText('Quantity', { exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Field type for quantity', exact: true }).click();
  await page.getByRole('option', { name: 'Text (Single line)', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save Template', exact: true }).click();
  await expect(page.getByText('Populated fields cannot be removed, retyped, or retargeted without a data migration', { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  expect((await records.read('record_categories', category.id)).template_fields).toEqual(category.template_fields);
  expect((await records.read('records', record.id)).data).toEqual({ quantity: 0 });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto(`/records/${record.id}`);
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('0');
});

test('UI active-status save rejects missing required value, then accepts zero without losing the draft', async ({ page, records }) => {
  const category = await records.category([{ id: 'n', name: 'quantity', label: 'Quantity', type: 'number', required: true }]);
  const record = await createRecordUI(page, records, category);
  const before = await records.read('records', record.id);
  expect(before.status).toBe('draft');
  await page.getByRole('combobox', { name: 'Record status', exact: true }).click();
  await page.getByRole('option', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Quantity: is required', { exact: true })).toBeVisible();
  const rejected = await records.read('records', record.id);
  expect(rejected.status).toBe('draft');
  expect(rejected.data).toEqual(before.data);
  expect(rejected.updated_at).toBe(before.updated_at);
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('0');
  await saveRecord(page, records, record.id, { status: 'active', data: { quantity: 0 } });
  await reloadRecord(page, record.title);
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('0');
  await expect(page.getByRole('combobox', { name: 'Record status', exact: true })).toHaveText('Active');
});