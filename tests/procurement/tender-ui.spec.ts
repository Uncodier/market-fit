import { test, expect } from '@playwright/test';
import { selectWorkspace } from '../support/workspace';
import { verifyProcurementAdmin, ProcurementJournal, resolveTender, publishTender, tenderDetail } from '../support/procurement-fixtures';
import { publicTenderPath, assertPublicTenderUnavailable } from '../support/procurement-ui';
import { readyTenderEditor, saveTenderEditor } from '../support/procurement-expansion';

test('buyer creates and edits a tender through UI; only approved publication exposes its immutable terms', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'ui-create-edit');
  await journal.record('tender');
  await page.goto('/purchases/tenders/new');
  const editor = page.getByRole('dialog', { name: 'Create tender', exact: true });
  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill(journal.marker);
  await editor.getByRole('textbox', { name: 'Public description and terms', exact: true }).fill('Synthetic procurement terms. No real fulfillment.');
  await editor.getByLabel('Description / specification', { exact: true }).fill(`${journal.marker} specification`);
  await editor.getByLabel('Quantity', { exact: true }).fill('2');
  await editor.getByLabel('Unit net estimate (minor units)', { exact: true }).fill('125');
  for (const [label, option] of [['Visibility', 'Public'], ['Participation', 'Open'], ['Offer opening policy', 'On receipt']]) {
    await editor.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
  await editor.getByRole('button', { name: 'Save working version', exact: true }).click();
  await expect(editor).toBeHidden();
  const created = await resolveTender(page, journal);
  expect(created.tender.version).toBe(1);
  expect(created.publications).toHaveLength(0);
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const publicPage = await anonymous.newPage();
    await assertPublicTenderUnavailable(publicPage, created);
    await page.getByRole('link', { name: 'Edit working version', exact: true }).click();
    const edit = await readyTenderEditor(page, created.tender.title);
    await edit.getByRole('textbox', { name: 'Title', exact: true }).fill(`${journal.marker} approved terms`);
    await saveTenderEditor(page, created.tender.id);
    const edited = await resolveTender(page, journal, `${journal.marker} approved terms`);
    expect(edited.tender.version).toBe(2);
    const published = await publishTender(page, edited, journal);
    await publicPage.goto(publicTenderPath(published));
    await expect(publicPage.locator('main > header').getByRole('heading', { name: edited.tender.title, exact: true, level: 1 })).toBeVisible();
    await publicPage.goto(publicTenderPath(published).split('/').slice(0, 3).join('/'));
    await expect(publicPage.getByRole('link').filter({ hasText: edited.tender.title }).first()).toBeVisible();
    await page.goto(`/purchases/tenders/${created.tender.id}/edit`);
    const workingEditor = await readyTenderEditor(page, published.tender.title);
    await workingEditor.getByRole('textbox', { name: 'Public description and terms', exact: true }).fill('Unpublished run-owned working change');
    await saveTenderEditor(page, created.tender.id);
    const working = await tenderDetail(page, created.tender.id);
    expect(working.tender.version).toBe(3);
    expect(working.publications[0]).toEqual(published.publications[0]);
    await publicPage.goto(publicTenderPath(published));
    await expect(publicPage.getByText('Synthetic procurement terms. No real fulfillment.', { exact: true })).toBeVisible();
    await expect(publicPage.getByText('Unpublished run-owned working change', { exact: true })).toHaveCount(0);
  } finally { await anonymous.close(); }
});