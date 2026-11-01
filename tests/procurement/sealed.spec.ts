import { test, expect } from '@playwright/test';
import { selectWorkspace } from '../support/workspace';
import { procurementPolicy } from '../support/procurement-policy';
import { procurementApi, procurementLogin, verifyProcurementAdmin, ProcurementJournal, setupTender, publishTender } from '../support/procurement-fixtures';
import { submitProposal } from '../support/procurement-ui';

test('sealed receipt count does not disclose quotation or pricing before the publication opening clock', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'sealed-receipt');
  const detail = await publishTender(page, await setupTender(page, journal, { opening: 'after_close' }), journal);
  const supplierContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const supplier = await supplierContext.newPage();
    await procurementLogin(supplier, 'buyer');
    const reference = `${journal.marker} private reference`;
    const id = await submitProposal(supplier, detail, journal, reference);
    const buyerRead = await procurementApi(page, `/api/procurement/commerce/quotes/${id}?site_id=${procurementPolicy().siteId}`);
    expect(buyerRead.status).toBe(404);
    expect(buyerRead.body).toEqual({ error: 'Quotation not found' });
    const list = await procurementApi(page, `/api/procurement/commerce/quotes?site_id=${procurementPolicy().siteId}`);
    expect(list.status).toBe(200);
    expect(list.body.data.filter((row: { id: string }) => row.id === id)).toHaveLength(0);
    const envelope = list.body.envelopes.find((row: { publication_id: string }) => row.publication_id === detail.publications[0].id);
    expect(envelope.received_count).toBe(1);
    expect(envelope.tender_id).toBe(detail.tender.id);
    expect(JSON.stringify(list.body)).not.toContain(reference);
    await page.goto(`/purchases/tenders/${detail.tender.id}`);
    await page.getByRole('tab', { name: 'Received quotations', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Sealed quotations', exact: true })).toBeVisible();
    await expect(page.getByText(reference, { exact: true })).toHaveCount(0);
  } finally { await supplierContext.close(); }
});