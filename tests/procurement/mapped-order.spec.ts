import { test, expect, type Page } from '@playwright/test';
import { selectWorkspace } from '../support/workspace';
import { procurementPolicy } from '../support/procurement-policy';
import { procurementApi, procurementLogin, verifyProcurementAdmin, ProcurementJournal, setupTender, publishTender } from '../support/procurement-fixtures';
import { submitProposal, reviewQuotation } from '../support/procurement-ui';

async function requestAndApprove(page: Page, event: 'award' | 'order', target: string, journal: ProcurementJournal) {
  await page.getByRole('tab', { name: 'Approvals', exact: true }).click();
  await journal.record(`${event}-approval`);
  await page.getByRole('button', { name: event === 'award' ? 'Request whole-tender award' : 'Request purchase order', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  const request = page.waitForResponse(res => res.url().includes('/commerce/approvals?') && res.request().method() === 'POST');
  await confirm.getByRole('button', { name: 'Confirm', exact: true }).click();
  const response = await request;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ target_id: target, expected_version: 1, event });
  const approval = (await response.json()).data;
  await journal.record(`${event}-approval`, approval.id);
  if (approval.status === 'pending') {
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve stage', exact: true });
    await dialog.getByRole('textbox').fill(`${journal.marker}: synthetic ${event} approval; no payment or delivery`);
    const decision = page.waitForResponse(res => res.url().includes(`/approvals/${approval.id}/decisions?`) && res.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Confirm decision', exact: true }).click();
    expect((await decision).status()).toBe(200);
    await expect(dialog).toBeHidden();
  } else expect(approval.status).toBe('approved');
}

test('mapped proposal follows actual closing clock, whole-tender award approval, order approval and non-stock acceptance', async ({ page, browser }, info) => {
  test.setTimeout(480_000);
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'mapped-order');
  // Use real published deadlines; never mutate immutable terms or the database clock.
  const detail = await publishTender(page, await setupTender(page, journal, { mapped: true, closesInMs: 180_000 }), journal);
  const supplierContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const supplier = await supplierContext.newPage();
    await procurementLogin(supplier, 'buyer');
    const reference = `${journal.marker} offer`;
    const id = await submitProposal(supplier, detail, journal, reference);
    await reviewQuotation(page, detail, id, reference, true);
    const openTender = page.getByRole('link', { name: 'Open tender', exact: true });
    await expect(openTender).toHaveAttribute('href', `/purchases/tenders/${detail.tender.id}`);
    await openTender.click();
    await expect(page).toHaveURL(new RegExp(`/purchases/tenders/${detail.tender.id}(?:[?#]|$)`));
    await expect(page.getByRole('heading', { name: detail.tender.title, exact: true, level: 2 })).toBeVisible();
    await page.getByRole('tab', { name: 'Received quotations', exact: true }).click();
    const received = page.getByRole('row').filter({ hasText: reference });
    await expect(received).toHaveCount(1);
    await received.click();
    await expect(page).toHaveURL(new RegExp(`/purchases/quotes/${id}(?:[?#]|$)`));
    await expect.poll(() => Date.now() >= Date.parse(detail.publications[0].snapshot.participation_deadline), {
      timeout: 210_000, intervals: [1000], message: 'The actual immutable publication closing/opening clock must elapse',
    }).toBe(true);
    await requestAndApprove(page, 'award', id, journal);
    const read = () => procurementApi(page, `/api/procurement/commerce/quotes/${id}?site_id=${procurementPolicy().siteId}`);
    await expect.poll(async () => (await read()).body.data.quotation.award_id).not.toBeNull();
    const awardId = (await read()).body.data.quotation.award_id;
    await journal.record('award', awardId);
    await page.reload();
    await requestAndApprove(page, 'order', awardId, journal);
    const orders = () => procurementApi(page, `/api/procurement/commerce/orders?site_id=${procurementPolicy().siteId}`);
    await expect.poll(async () => (await orders()).body.data.filter((row: { quotation_id: string }) => row.quotation_id === id).length).toBe(1);
    const order = (await orders()).body.data.find((row: { quotation_id: string }) => row.quotation_id === id);
    expect(order.award_id).toBe(awardId);
    expect(order.net_amount_minor).toBe(250);
    expect(order.lines).toHaveLength(1);
    await journal.record('order', order.id);
    await page.goto('/purchases/orders');
    await page.getByRole('button', { name: order.id.slice(0, 8), exact: true }).click();
    const acceptance = page.getByRole('dialog');
    await acceptance.locator(`input[id="receipt-${order.lines[0].id}"]`).fill('2');
    await acceptance.getByLabel('Acceptance note', { exact: true }).fill(`${journal.marker} synthetic non-stock acceptance`);
    const receipt = page.waitForResponse(res => res.url().includes('/commerce/receipts?') && res.request().method() === 'POST');
    await journal.record('receipt');
    await acceptance.getByRole('button', { name: 'Record non-stock acceptance', exact: true }).click();
    const recorded = await receipt;
    expect(recorded.status()).toBe(200);
    await journal.record('receipt', (await recorded.json()).data);
    await expect.poll(async () => (await orders()).body.data.find((row: { id: string }) => row.id === order.id).lines[0].received_quantity).toBe(2);
  } finally { await supplierContext.close(); }
});