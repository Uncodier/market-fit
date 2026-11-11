import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { requireUuid } from './mutation-safety';
import { assertWorkspace, dismissConsent } from './workspace';
import type { Category, RecordsFixture } from './records-fixtures';

export async function recordsList(page: Page) {
  const response = await page.goto('/records');
  expect(response?.ok()).toBe(true);
  await dismissConsent(page);
  await assertWorkspace(page);
  await expect(page.getByRole('button', { name: 'New Record', exact: true })).toBeVisible();
}

export async function createRecordUI(page: Page, fixture: RecordsFixture, category: Category) {
  await recordsList(page);
  await page.getByRole('button', { name: category.name, exact: true }).click();
  await fixture.uiAttempt(category);
  await page.getByRole('button', { name: 'New Record', exact: true }).click();
  await expect(page).toHaveURL(/\/records\/[0-9a-f-]{36}$/);
  const id = requireUuid(new URL(page.url()).pathname.split('/').pop()!, 'Created record');
  await fixture.uiCreated(category, id); // Capture ID before title editing can fail.
  expect(await fixture.read('records', id)).toMatchObject({ category_id: category.id, status: 'draft' });
  const title = `${fixture.marker} subject ${id}`;
  await page.getByPlaceholder('Record Title', { exact: true }).fill(title);
  await saveRecord(page, fixture, id, { title });
  return { id, title };
}

export async function saveRecord(page: Page, fixture: RecordsFixture, id: string, expected: Record<string, unknown>) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Record saved', { exact: true })).toBeVisible();
  await expect.poll(() => fixture.read('records', id)).toMatchObject(expected);
}

export async function reloadRecord(page: Page, title: string) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('Record Title', { exact: true })).toHaveValue(title);
  await assertWorkspace(page);
}

export async function chooseRelation(page: Page, label: string, name: string) {
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(name);
  // RelationSelect exposes IDs on its portalled option divs, not native options.
  const option = page.locator('[data-relation-id]').filter({ has: page.getByText(name, { exact: true }) });
  await expect(option).toHaveCount(1);
  await option.click();
  await expect(input).toHaveValue(name);
}

/** Negative picker assertions wait for the actual filtered Data API read, not a transient empty list. */
export async function searchRecordRelation(page: Page, name: string, excludedId: string) {
  const settled = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/rest/v1/records' && url.searchParams.get('title') === `ilike.%${name.replace(/[%_\\]/g, '\\$&')}%`
      && response.request().method() === 'GET';
  });
  await page.getByRole('textbox', { name: 'Linked record', exact: true }).fill(name);
  const response = await settled;
  expect(response.ok()).toBe(true);
  const rows = await response.json() as { id: string }[];
  expect(rows.map(row => row.id)).not.toContain(excludedId);
  await expect(page.getByText('No results found', { exact: true })).toBeVisible();
  await expect(page.locator(`[data-relation-id="${excludedId}"]`)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Linked record', exact: true }).getByRole('alert')).toHaveCount(0);
}

export async function editCategory(page: Page, category: Category) {
  await recordsList(page);
  const categoryButton = page.getByRole('button', { name: category.name, exact: true });
  await expect(categoryButton).toHaveCount(1);
  await categoryButton.locator('..').hover();
  await page.getByRole('button', { name: `Edit template: ${category.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Category Template', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Category creation itself uses UI; reconcile only the exact new name, never adopt an old row. */
export async function createNumberCategoryUI(page: Page, fixture: RecordsFixture) {
  await recordsList(page);
  const name = `${fixture.marker} UI category ${randomUUID()}`;
  const lookup = () => fixture.admin.client.from('record_categories').select('id,name,template_fields')
    .eq('site_id', fixture.admin.siteId).eq('name', name);
  const absent = await lookup();
  expect(absent.error).toBeNull();
  expect(absent.data).toEqual([]);
  await fixture.uiAttempt({ id: name, name, template_fields: [] });
  try {
    await page.getByTitle('New Category', { exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New Category Template', exact: true });
    await dialog.getByPlaceholder('e.g., Knowledge Base').fill(name);
    await dialog.getByRole('button', { name: 'Add Field', exact: true }).click();
    await dialog.getByLabel('Field Name (Storage Key)', { exact: true }).fill('quantity');
    await dialog.getByLabel('Display Label (Optional)', { exact: true }).fill('Original quantity');
    await dialog.getByRole('combobox', { name: 'Field type for quantity', exact: true }).click();
    await page.getByRole('option', { name: 'Number', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save Template', exact: true }).click();
    await expect(dialog).toBeHidden();
  } finally {
    const result = await lookup();
    expect(result.error).toBeNull();
    expect(result.data, 'Unresolved create must retain journal, never broad cleanup').toHaveLength(1);
    await fixture.uiCategoryCreated(result.data![0] as Category);
  }
  const category = (await lookup()).data![0] as Category;
  expect(category.template_fields).toEqual([expect.objectContaining({ name: 'quantity', label: 'Original quantity', type: 'number' })]);
  return category;
}