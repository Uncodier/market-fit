import { expect, type Page } from '@playwright/test';
import { procurementApi, ProcurementJournal } from './procurement-fixtures';
import { procurementPolicy } from './procurement-policy';
import { emptySupplier } from '../../app/suppliers/schema';

export async function createApprovedSupplier(page: Page, journal: ProcurementJournal) {
  const siteId = procurementPolicy().siteId;
  await journal.record('supplier-creation');
  const created = await procurementApi(page, `/api/procurement/suppliers?site_id=${siteId}`, 'POST', {
    ...emptySupplier, name: `${journal.marker} supplier`, commercial_terms: 'Synthetic QA only; no actual purchasing.',
  });
  expect(created.status).toBe(201);
  const supplier = created.body.supplier;
  expect(supplier.site_id).toBe(siteId);
  expect(supplier.status).toBe('prospect');
  await journal.record('supplier', supplier.id);
  const approved = await procurementApi(page, `/api/procurement/suppliers/${supplier.id}?site_id=${siteId}`, 'PUT', {
    ...emptySupplier, expected_version: supplier.version, name: supplier.name,
    commercial_terms: supplier.commercial_terms, status: 'approved',
  });
  expect(approved.status).toBe(200);
  const persisted = await procurementApi(page, `/api/procurement/suppliers/${supplier.id}?site_id=${siteId}`);
  expect(persisted.status).toBe(200);
  expect(persisted.body.supplier.status).toBe('approved');
  expect(persisted.body.supplier.version).toBe(supplier.version + 1);
  return persisted.body.supplier as { id: string; name: string };
}

export async function fileStatus(page: Page, revision: string) {
  return page.evaluate(async id => {
    const result = await fetch(`/api/procurement/credentials/revisions/${id}/file`, { cache: 'no-store' });
    return { status: result.status, contentType: result.headers.get('content-type') };
  }, revision);
}

/** Wait only for actual editor hydration; ordinary interactions retain their default timeout. */
export async function readyTenderEditor(page: Page, expectedTitle: string) {
  const editor = page.getByRole('dialog', { name: 'Edit tender', exact: true });
  await expect(editor).toBeVisible({ timeout: 45_000 });
  await expect(editor.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(expectedTitle, { timeout: 45_000 });
  await expect(editor.getByRole('textbox', { name: 'Public description and terms', exact: true })).toBeEnabled({ timeout: 45_000 });
  return editor;
}

export async function saveTenderEditor(page: Page, tenderId: string) {
  const editor = page.getByRole('dialog', { name: 'Edit tender', exact: true });
  const response = page.waitForResponse(res => res.url().includes(`/tenders/${tenderId}?`) && res.request().method() === 'PUT');
  await editor.getByRole('button', { name: 'Save working version', exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(200);
  expect((await saved.json()).id).toBe(tenderId);
  await expect(editor).toBeHidden();
}

export async function republishAmendment(page: Page, tenderId: string, journal: ProcurementJournal) {
  await page.goto(`/purchases/tenders/${tenderId}`);
  const response = page.waitForResponse(res => res.url().includes(`/tenders/${tenderId}/publish?`) && res.request().method() === 'POST');
  await journal.record('amendment-publication-approval');
  await page.getByRole('button', { name: 'Request publication', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  const approval = await result.json();
  await journal.record('amendment-publication-approval', approval.approval_id);
  if (approval.status === 'pending') {
    await page.getByRole('tab', { name: 'Approvals', exact: true }).click();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve stage', exact: true });
    await dialog.getByRole('textbox').fill(`${journal.marker} amendment reviewed`);
    const decision = page.waitForResponse(res => res.url().includes(`/approvals/${approval.approval_id}/decisions?`) && res.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Confirm decision', exact: true }).click();
    expect((await decision).status()).toBe(200);
    await expect(dialog).toBeHidden();
  } else expect(approval.status).toBe('published');
}