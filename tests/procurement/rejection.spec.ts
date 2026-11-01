import { test, expect } from '@playwright/test';
import { selectWorkspace } from '../support/workspace';
import { verifyProcurementAdmin, ProcurementJournal, setupTender, tenderDetail, procurementApi } from '../support/procurement-fixtures';
import { procurementPolicy } from '../support/procurement-policy';
import { assertPublicTenderUnavailable } from '../support/procurement-ui';

test('eligible buyer rejects publication through UI; duplicate opposite decision cannot release terms', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'publication-rejection');
  const created = await setupTender(page, journal);
  await page.goto(`/purchases/tenders/${created.tender.id}`);
  await journal.record('rejected-publication-approval');
  const publish = page.waitForResponse(res => res.url().includes(`/tenders/${created.tender.id}/publish?`) && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Request publication', exact: true }).click();
  const result = await publish;
  expect(result.status()).toBe(200);
  const approval = await result.json();
  expect(approval.status, 'This scenario requires the real QA human manager fallback policy').toBe('pending');
  await journal.record('rejected-publication-approval', approval.approval_id);
  await page.getByRole('tab', { name: 'Approvals', exact: true }).click();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reject approval stage', exact: true });
  await dialog.getByRole('textbox').fill(`${journal.marker} synthetic rejection rationale`);
  const decision = page.waitForResponse(res => res.url().includes(`/approvals/${approval.approval_id}/decisions?`) && res.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Confirm decision', exact: true }).click();
  const rejected = await decision;
  expect(rejected.status()).toBe(200);
  await expect(dialog).toBeHidden();
  const duplicate = await procurementApi(page, `/api/procurement/approvals/${approval.approval_id}/decisions?site_id=${procurementPolicy().siteId}`, 'POST', {
    ...rejected.request().postDataJSON(), decision: 'approve', reason: `${journal.marker} duplicate opposite vote`,
  });
  expect(duplicate.status).toBe(409);
  const detail = await tenderDetail(page, created.tender.id);
  expect(detail.publications).toHaveLength(0);
  expect(detail.tender.status).toBe('draft');
  const read = await procurementApi(page, `/api/procurement/approvals?site_id=${procurementPolicy().siteId}&target_id=${created.tender.id}`);
  expect(read.status).toBe(200);
  const saved = read.body.approvals.find((row: { id: string }) => row.id === approval.approval_id);
  expect(saved.status).toBe('rejected');
  expect(saved.procurement_event_stages[0].own_decision).toBe('reject');
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const guest = await anonymous.newPage();
    await assertPublicTenderUnavailable(guest, detail);
  } finally { await anonymous.close(); }
});