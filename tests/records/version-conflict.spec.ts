import { test, expect } from '../support/records-fixtures';
import { createRecordUI, recordsList, saveRecord } from '../support/records-ui';

test('inline status edit saves a new row even when its loaded version is stale', async ({ page, records }) => {
  const category = await records.category();
  const subject = await createRecordUI(page, records, category);
  const list = await page.context().newPage();
  try {
    await recordsList(list);
    await list.getByRole('button', { name: category.name, exact: true }).click();
    const status = list.getByRole('button', { name: `Edit Status for ${subject.title}`, exact: true });
    await expect(status).toBeVisible();
    const newTitle = `${subject.title} updated`;
    await page.getByPlaceholder('Record Title', { exact: true }).fill(newTitle);
    await saveRecord(page, records, subject.id, { title: newTitle });

    await status.click();
    await list.getByRole('option', { name: 'Published', exact: true }).click();
    await expect.poll(() => records.read('records', subject.id)).toMatchObject({ title: newTitle, status: 'published' });
    await expect(list.getByRole('button', { name: `Edit Status for ${newTitle}`, exact: true })).toBeVisible();
  } finally {
    await list.close();
  }
});

test('stale editor merges changes to different fields without warning', async ({ page, records }) => {
  const category = await records.category([{ id: 'n', name: 'quantity', label: 'Quantity', type: 'number' }]);
  const subject = await createRecordUI(page, records, category);
  const stale = await page.context().newPage();
  try {
    await stale.goto(`/records/${subject.id}`);
    const title = stale.getByPlaceholder('Record Title', { exact: true });
    await expect(title).toHaveValue(subject.title);
    const currentTitle = `${subject.title} saved by first tab`;
    await page.getByPlaceholder('Record Title', { exact: true }).fill(currentTitle);
    await saveRecord(page, records, subject.id, { title: currentTitle });

    await stale.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('4');
    await saveRecord(stale, records, subject.id, { title: currentTitle, data: { quantity: 4 } });
    await expect(title).toHaveValue(currentTitle);
    await expect(stale.getByText('Some changes weren’t saved', { exact: true })).toHaveCount(0);
  } finally {
    await stale.close();
  }
});

test('stale editor cannot overwrite another tab and keeps unsaved input until reload', async ({ page, records }) => {
  const category = await records.category();
  const subject = await createRecordUI(page, records, category);
  const stale = await page.context().newPage();
  try {
    await stale.goto(`/records/${subject.id}`);
    await expect(stale.getByPlaceholder('Record Title', { exact: true })).toHaveValue(subject.title);
    const currentTitle = `${subject.title} saved by first tab`;
    await page.getByPlaceholder('Record Title', { exact: true }).fill(currentTitle);
    await saveRecord(page, records, subject.id, { title: currentTitle });
    const current = await records.read('records', subject.id);
    const staleTitle = `${subject.title} unsaved second tab`;
    await stale.getByPlaceholder('Record Title', { exact: true }).fill(staleTitle);
    await stale.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(stale.getByText('Some changes weren’t saved', { exact: true })).toBeVisible();
    await expect(stale.getByPlaceholder('Record Title', { exact: true })).toHaveValue(staleTitle);
    await expect(stale.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    const unchanged = await records.read('records', subject.id);
    expect(unchanged.title).toBe(currentTitle);
    expect(unchanged.updated_at).toBe(current.updated_at);
    stale.once('dialog', dialog => dialog.accept());
    await stale.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(stale.getByPlaceholder('Record Title', { exact: true })).toHaveValue(currentTitle);
  } finally {
    await stale.close();
  }
});