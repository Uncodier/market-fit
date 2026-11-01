import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectWorkspace } from '../support/workspace';
import { procurementPolicy } from '../support/procurement-policy';
import { procurementApi, procurementLogin, verifyProcurementAdmin, ProcurementJournal, setupTender, publishTender } from '../support/procurement-fixtures';
import { openProposal, publicTenderPath, submitProposal, reviewQuotation } from '../support/procurement-ui';

test('personal free-text proposal saves a database draft, resumes in a fresh login, submits and reaches buyer review', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'personal-draft');
  const detail = await publishTender(page, await setupTender(page, journal), journal);
  const reference = `${journal.marker} offer`;
  const first = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const supplier = await first.newPage();
    await procurementLogin(supplier, 'buyer');
    await supplier.goto('/home/submissions');
    const opportunities = await procurementApi(supplier, '/api/procurement/credentials/participation');
    expect(opportunities.status).toBe(200);
    expect(opportunities.body.opportunities.some((row: { publication_id: string; acting_as_self: boolean }) =>
      row.publication_id === detail.publications[0].id && row.acting_as_self)).toBe(true);
    const sheet = await openProposal(supplier, detail);
    await sheet.getByLabel('Your quotation reference', { exact: true }).fill(reference);
    await sheet.locator(`input[id="price-${detail.tender.requirements[0].id}"]`).fill('125');
    // A small, syntactically complete synthetic PDF. This is a real private upload.
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    await sheet.getByLabel('Your legal name', { exact: true }).fill(journal.marker);
    await sheet.getByLabel('Proposal PDF (optional, maximum 8 MiB)', { exact: true }).setInputFiles({
      name: 'qa-procurement-proposal.pdf', mimeType: 'application/pdf', buffer: pdf,
    });
    const upload = supplier.waitForResponse(res => res.url().endsWith('/procurement/credentials') && res.request().method() === 'POST');
    await journal.record('proposal-upload');
    await sheet.getByRole('button', { name: 'Upload proposal', exact: true }).click();
    const uploaded = await upload;
    expect(uploaded.status()).toBe(201);
    const uploadedBody = await uploaded.json();
    const revisionId = uploadedBody.revision_id;
    await journal.record('proposal-credential', uploadedBody.credential_id);
    await journal.record('proposal-revision', revisionId);
    await expect(sheet.getByRole('link', { name: 'View uploaded proposal', exact: true })).toBeVisible();
    const save = supplier.waitForResponse(res => res.url().endsWith('/credentials/drafts') && res.request().method() === 'PUT');
    await journal.record('saved-personal-draft');
    await sheet.getByRole('button', { name: 'Save draft', exact: true }).click();
    expect((await save).status()).toBe(200);
    await expect(sheet).toBeHidden();
    const saved = await procurementApi(supplier, `/api/procurement/credentials/drafts?publication_id=${detail.publications[0].id}&version=${detail.publications[0].version}&applicant_key=personal`);
    expect(saved.status).toBe(200);
    expect(saved.body.draft.reference).toBe(reference);
    expect(saved.body.draft.prices[detail.tender.requirements[0].id]).toBe('125');
    expect(saved.body.draft.attempted).toBe(false);
    expect(saved.body.draft.proposalRevision).toBe(revisionId);
    expect(saved.body.draft_revision).toBeGreaterThan(0);
  } finally { await first.close(); }
  const resumed = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const supplier = await resumed.newPage();
    await procurementLogin(supplier, 'buyer');
    const id = await submitProposal(supplier, detail, journal, reference, true);
    await reviewQuotation(page, detail, id, reference);
    await page.getByRole('tab', { name: 'Certificates & proposal', exact: true }).click();
    const proposal = page.getByRole('link', { name: 'Download shared evidence: qa-procurement-proposal.pdf', exact: true });
    await expect(proposal).toBeVisible();
    const download = page.waitForEvent('download');
    await proposal.click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe('evidence');
    const downloadedPath = await downloaded.path();
    expect(downloadedPath).not.toBeNull();
    expect((await readFile(downloadedPath!)).subarray(0, 8).toString()).toBe('%PDF-1.4');
    const award = await procurementApi(page, `/api/procurement/commerce/approvals?site_id=${procurementPolicy().siteId}`, 'POST', {
      target_id: id, expected_version: 1, event: 'award',
    });
    expect(award.status, 'Award cannot bypass published closing/opening clocks').toBe(409);
    const orders = await procurementApi(page, `/api/procurement/commerce/orders?site_id=${procurementPolicy().siteId}`);
    expect(orders.status).toBe(200);
    expect(orders.body.data.filter((row: { quotation_id: string }) => row.quotation_id === id)).toHaveLength(0);
  } finally { await resumed.close(); }
});

test('authorized foreign business applicant submits mapped pricing, separately from its personal draft', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'business-mapped');
  const detail = await publishTender(page, await setupTender(page, journal, { mapped: true }), journal);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const supplier = await context.newPage();
    await procurementLogin(supplier, 'foreign');
    const opportunities = await procurementApi(supplier, '/api/procurement/credentials/participation');
    expect(opportunities.status).toBe(200);
    const choices = opportunities.body.opportunities.filter((row: { publication_id: string }) => row.publication_id === detail.publications[0].id);
    const business = choices.find((row: { acting_site_id: string }) => row.acting_site_id === procurementPolicy().foreignSiteId);
    expect(business, 'Provisioned foreign owner must have an eligible acting business').toBeDefined();
    const sheet = await openProposal(supplier, detail);
    const reference = `${journal.marker} business offer`;
    await sheet.getByLabel('Your quotation reference', { exact: true }).fill(`${journal.marker} personal only`);
    await sheet.getByRole('combobox', { name: 'Who are you applying on behalf of?', exact: true }).click();
    await supplier.getByRole('option', { name: business.supplier_name, exact: true }).click();
    await expect(sheet.getByLabel('Your quotation reference', { exact: true })).toHaveValue('');
    await sheet.getByLabel('Your quotation reference', { exact: true }).fill(reference);
    await sheet.locator(`input[id="price-${detail.tender.requirements[0].id}"]`).fill('125');
    const registration = supplier.waitForResponse(res => res.url().endsWith('/participation/register') && res.request().method() === 'POST');
    const submission = supplier.waitForResponse(res => res.url().includes('/commerce/submissions?') && res.request().method() === 'POST');
    await journal.record('business-registration-and-quotation');
    await sheet.getByRole('button', { name: 'Submit immutable quotation', exact: true }).click();
    const registered = await registration;
    expect(registered.status()).toBe(200);
    expect(registered.request().postDataJSON()).toEqual({ publication_id: detail.publications[0].id, acting_site_id: procurementPolicy().foreignSiteId });
    await journal.record('business-supplier', (await registered.json()).supplier_id);
    const submitted = await submission;
    expect(submitted.status()).toBe(200);
    const id = (await submitted.json()).data.quotation_id;
    await journal.record('quotation', id);
    const quote = await reviewQuotation(page, detail, id, reference, true);
    expect(quote.supplier_name).toBe(business.supplier_name);
    const award = await procurementApi(page, `/api/procurement/commerce/approvals?site_id=${procurementPolicy().siteId}`, 'POST', {
      target_id: id, expected_version: quote.procurement_revision, event: 'award',
    });
    expect(award.status).toBe(409);
    const privateRead = await procurementApi(supplier, `/api/procurement/commerce/quotes/${id}?site_id=${procurementPolicy().siteId}`);
    expect(privateRead.status).toBe(403);
    await supplier.goto(publicTenderPath(detail));
    await expect(supplier.locator('main > header').getByRole('heading', { name: detail.tender.title, exact: true, level: 1 })).toBeVisible();
  } finally { await context.close(); }
});