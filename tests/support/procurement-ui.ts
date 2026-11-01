import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { toSiteSlug } from '../../app/book/site-slug';
import { procurementPolicy } from './procurement-policy';
import { procurementApi, ProcurementJournal, type ProcurementDetail } from './procurement-fixtures';
import { fixtureClient } from './mutation-fixtures';

export function publicTenderPath(detail: ProcurementDetail) {
  return `/tenders/${toSiteSlug(procurementPolicy().siteName)}/${detail.tender.portal_slug}`;
}

/** Next not-found responses can stream HTTP 200; denial requires UI AND anonymous RPC absence. */
export async function assertPublicTenderUnavailable(page: Page, detail: ProcurementDetail) {
  const policy = procurementPolicy();
  expect(detail.publications, 'Backend must independently confirm no publication').toHaveLength(0);
  const url = `${policy.commerceBaseURL}${publicTenderPath(detail)}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response, 'Public tender response must exist').not.toBeNull();
  expect([200, 404], 'Only documented streamed/non-streamed not-found status is accepted').toContain(response!.status());
  await expect(page).toHaveURL(url);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Tender not found', exact: true, level: 1 })).toBeVisible();
  await expect(main.getByText('This publication is not available in the public directory.', { exact: true })).toBeVisible();
  await expect(page.getByText(detail.tender.title, { exact: true })).toHaveCount(0);
  if (detail.tender.description) await expect(page.getByText(detail.tender.description, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit proposal', exact: true })).toHaveCount(0);
  const { client } = await fixtureClient();
  const portal = await client.from('procurement_tender_portals').select('slug,enabled').eq('site_id', policy.siteId).single();
  expect(portal.error, 'Exact QA portal identity must be readable').toBeNull();
  expect(portal.data?.enabled).toBe(true);
  expect(portal.data?.slug).toMatch(/^[a-z0-9][a-z0-9-]{2,79}$/);
  const anonymous = createClient(policy.backend, policy.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await anonymous.rpc('public_procurement_tenders', {
    p_site_slug: portal.data!.slug, p_tender_slug: detail.tender.portal_slug, p_page: 0, p_search: '',
  });
  expect(result.error, 'Anonymous public RPC must succeed, not hide an outage').toBeNull();
  expect(result.data, 'Unpublished/rejected tender must have no anonymously visible publication').toEqual([]);
}

export async function openProposal(page: Page, detail: ProcurementDetail) {
  await page.goto(publicTenderPath(detail));
  await expect(page.locator('main > header').getByRole('heading', { name: detail.publications[0].snapshot.title, exact: true, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Submit proposal', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Submit proposal', exact: true });
  await expect(sheet).toHaveCount(1);
  await expect(sheet).toHaveAttribute('data-submission-checkout', 'true');
  await expect(sheet).toHaveAttribute('data-state', 'open');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Your quotation reference', { exact: true })).toBeEnabled();
  return sheet;
}

export async function submitProposal(page: Page, detail: ProcurementDetail, journal: ProcurementJournal, reference: string, resume = false) {
  const sheet = await openProposal(page, detail);
  if (resume) {
    await expect(sheet.getByLabel('Your quotation reference', { exact: true })).toHaveValue(reference);
    await expect(sheet.locator(`input[id="price-${detail.tender.requirements[0].id}"]`)).toHaveValue('125');
  } else {
    await sheet.getByLabel('Your quotation reference', { exact: true }).fill(reference);
    await sheet.locator(`input[id="price-${detail.tender.requirements[0].id}"]`).fill('125');
  }
  await journal.record('supplier-registration-and-quotation');
  const response = page.waitForResponse(res => res.url().includes('/commerce/submissions?') && res.request().method() === 'POST');
  await sheet.getByRole('button', { name: 'Submit immutable quotation', exact: true }).click();
  const submitted = await response;
  expect(submitted.status()).toBe(200);
  await journal.record('participating-supplier', submitted.request().postDataJSON().supplier_id);
  const id = (await submitted.json()).data.quotation_id;
  await journal.record('quotation', id);
  await expect(page.getByText('Quotation submitted. This is not an award or certification acceptance.', { exact: true }).first()).toBeVisible();
  return id as string;
}

export async function reviewQuotation(page: Page, detail: ProcurementDetail, id: string, reference: string, mapped = false) {
  const result = await procurementApi(page, `/api/procurement/commerce/quotes/${id}?site_id=${procurementPolicy().siteId}`);
  expect(result.status).toBe(200);
  const quote = result.body.data.quotation;
  expect(quote.id).toBe(id);
  expect(quote.tender_id).toBe(detail.tender.id);
  expect(quote.publication_id).toBe(detail.publications[0].id);
  expect(quote.reference).toBe(reference);
  expect(quote.source).toBe('supplier_submitted');
  expect(quote.net_amount_minor).toBe(250);
  expect(quote.award_id).toBeNull();
  expect(quote.lines).toHaveLength(1);
  expect(quote.lines[0].quantity).toBe(2);
  expect(quote.lines[0].unit_net_minor).toBe(125);
  if (mapped) expect(quote.tax_amount_minor).not.toBeNull();
  else {
    expect(quote.tax_amount_minor).toBeNull();
    expect(quote.lines[0].tax_amount_minor).toBeNull();
  }
  await page.goto(`/purchases/tenders/${detail.tender.id}`);
  await page.getByRole('tab', { name: 'Received quotations', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: reference });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/purchases/quotes/${id}(?:[?#]|$)`));
  await expect(page.getByText(reference, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(detail.tender.requirements[0].description, { exact: true }).first()).toBeVisible();
  if (!mapped) await expect(page.getByText('Taxes pending', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /convert to|send quotation/i })).toHaveCount(0);
  return quote;
}