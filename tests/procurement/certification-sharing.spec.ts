import { test, expect } from '@playwright/test';
import { selectWorkspace } from '../support/workspace';
import { verifyProcurementAdmin, ProcurementJournal, setupTender, publishTender, procurementLogin, procurementApi } from '../support/procurement-fixtures';
import { openProposal, reviewQuotation } from '../support/procurement-ui';
import { fileStatus } from '../support/procurement-expansion';

test('personal certification uploads in-flow, is explicitly selected and shared; another applicant cannot download it', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'certification-sharing');
  const detail = await publishTender(page, await setupTender(page, journal), journal);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const foreignContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const supplier = await context.newPage();
    await procurementLogin(supplier, 'buyer');
    const sheet = await openProposal(supplier, detail);
    const reference = `${journal.marker} offer`;
    await sheet.getByLabel('Your quotation reference', { exact: true }).fill(reference);
    await sheet.locator(`input[id="price-${detail.tender.requirements[0].id}"]`).fill('125');
    await sheet.getByRole('button', { name: 'Upload certification', exact: true }).click();
    const credential = supplier.getByRole('dialog', { name: 'Upload personal credential', exact: true });
    await credential.getByLabel('Your legal name', { exact: true }).fill(journal.marker);
    await credential.getByLabel('Credential title', { exact: true }).fill(`${journal.marker} certificate`);
    await credential.getByLabel('Issuer', { exact: true }).fill('Synthetic QA issuer');
    await credential.getByLabel('Private file (PDF, PNG or JPEG, maximum 8 MiB)', { exact: true }).setInputFiles({
      name: 'qa-certification.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),
    });
    await journal.record('certification-upload');
    const upload = supplier.waitForResponse(res => res.url().endsWith('/procurement/credentials') && res.request().method() === 'POST');
    await credential.getByRole('button', { name: 'Save revision', exact: true }).click();
    const uploaded = await upload;
    expect(uploaded.status()).toBe(201);
    const body = await uploaded.json();
    await journal.record('credential', body.credential_id);
    await journal.record('certification-revision', body.revision_id);
    await expect(credential).toBeHidden();
    await expect(sheet.getByLabel('Your quotation reference', { exact: true })).toHaveValue(reference);
    const evidence = sheet.locator(`[id="evidence-${detail.tender.requirements[0].id}"]`);
    await expect(evidence).toContainText(`${journal.marker} certificate`);
    expect((await fileStatus(supplier, body.revision_id)).status).toBe(200);
    expect((await fileStatus(page, body.revision_id)).status).toBe(404);
    const foreign = await foreignContext.newPage();
    await procurementLogin(foreign, 'foreign');
    expect((await fileStatus(foreign, body.revision_id)).status).toBe(404);
    const submit = supplier.waitForResponse(res => res.url().includes('/commerce/submissions?') && res.request().method() === 'POST');
    await sheet.getByRole('button', { name: 'Submit immutable quotation', exact: true }).click();
    const submitted = await submit;
    expect(submitted.status()).toBe(200);
    expect(submitted.request().postDataJSON().evidence).toEqual([{ requirement_id: detail.tender.requirements[0].id, revision_id: body.revision_id }]);
    const id = (await submitted.json()).data.quotation_id;
    await journal.record('quotation', id);
    await reviewQuotation(page, detail, id, reference);
    await page.getByRole('tab', { name: 'Certificates & proposal', exact: true }).click();
    await expect(page.getByRole('article', { name: `${journal.marker} certificate`, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download shared evidence: qa-certification.pdf', exact: true })).toBeVisible();
    expect((await fileStatus(page, body.revision_id)).status).toBe(200);
    expect((await fileStatus(foreign, body.revision_id)).status).toBe(404);
    const credentials = await procurementApi(supplier, '/api/procurement/credentials');
    expect(credentials.status).toBe(200);
    expect(credentials.body.credentials.some((row: { id: string }) => row.id === body.credential_id)).toBe(true);
  } finally { await Promise.all([context.close(), foreignContext.close()]); }
});