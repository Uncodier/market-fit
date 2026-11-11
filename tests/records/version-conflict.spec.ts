import { test, expect } from '../support/records-fixtures';
import { createRecordUI, saveRecord } from '../support/records-ui';

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
    await expect(stale.getByText('Save conflict', { exact: true })).toBeVisible();
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