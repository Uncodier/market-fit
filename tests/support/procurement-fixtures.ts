import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { bindBrowserFixture, fixtureClient } from './mutation-fixtures';
import { boundSessionToken } from './project-lifecycle-policy';
import { required, requireUuid } from './mutation-safety';
import { procurementPolicy, assertProcurementQaOwnership, procurementMarker } from './procurement-policy';
import { dismissConsent } from './workspace';
import type { Tender, TenderDocument, TenderPublication } from '../../app/purchases/tenders/schema';

/** Real same-origin session requests, not intercepted browser routes or service access. */
export async function procurementApi(page: Page, path: string, method = 'GET', body?: unknown) {
  const policy = procurementPolicy();
  if (!path.startsWith('/api/procurement/') || new URL(page.url()).origin !== policy.baseURL) {
    throw new Error('Procurement request must stay on the verified QA application origin');
  }
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}

export async function verifyProcurementAdmin(page: Page) {
  const policy = procurementPolicy();
  await bindBrowserFixture(page);
  const { client } = await fixtureClient();
  const user = await client.auth.getUser();
  assertProcurementQaOwnership(user.data.user?.app_metadata, 'admin');
  const site = await client.from('sites').select('description').eq('id', policy.siteId).single();
  if (site.error) throw new Error('QA workspace ownership could not be read');
  let metadata: unknown;
  try { metadata = JSON.parse(site.data.description); } catch { throw new Error('QA workspace ownership is missing'); }
  assertProcurementQaOwnership(metadata);
  const catalog = await client.from('catalog_items').select('id,site_id,currency,status,metadata,track_inventory')
    .eq('id', policy.catalogItemId).eq('site_id', policy.siteId).single();
  if (catalog.error || catalog.data.currency !== 'USD' || catalog.data.status !== 'active' || catalog.data.track_inventory !== false) {
    throw new Error('Procurement requires the exact active USD non-stock QA catalog fixture');
  }
  assertProcurementQaOwnership(catalog.data.metadata);
  const portal = await procurementApi(page, `/api/procurement/tenders/portal?site_id=${policy.siteId}`);
  expect(portal.status, 'Installer must enable the disposable tender portal; tests never change shared settings').toBe(200);
  expect(portal.body.enabled, 'Pre-enabled QA portal is required').toBe(true);
  return client;
}

/** Secondary contexts always perform actual password UI authentication. */
export async function procurementLogin(page: Page, role: 'buyer' | 'collaborator' | 'foreign') {
  const policy = procurementPolicy();
  const prefix = `TEST_${role.toUpperCase()}`;
  await page.goto(`${policy.baseURL}/auth?returnTo=%2Fhome%2Fsubmissions`);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await dismissConsent(page);
  await page.locator('input[name="email"]').fill(required(process.env, `${prefix}_EMAIL`));
  await page.locator('input[name="password"]').fill(required(process.env, `${prefix}_PASSWORD`));
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).toBe('/home/submissions');
  const token = boundSessionToken(await page.context().cookies(policy.baseURL), policy.backend);
  const client = createClient(policy.backend, policy.key, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const user = await client.auth.getUser(token);
  if (user.error || user.data.user?.email?.toLowerCase() !== required(process.env, `${prefix}_EMAIL`).toLowerCase()) {
    throw new Error('Secondary browser account/backend binding failed');
  }
  assertProcurementQaOwnership(user.data.user.app_metadata, role);
  await dismissConsent(page);
}

export type ProcurementDetail = { tender: Tender; publications: TenderPublication[]; publication_pending: boolean };

export class ProcurementJournal {
  readonly marker: string;
  private entries: { kind: string; id?: string; state: string }[] = [];
  constructor(private info: TestInfo, private scenario: string) { this.marker = procurementMarker(scenario); }
  async record(kind: string, id?: string) {
    if (id) requireUuid(id, `${kind} persisted ID`);
    this.entries.push({ kind, ...(id ? { id } : {}), state: id ? 'retained' : 'creation-attempted' });
    const { qaId, runId, siteId, expiresAt, backend } = procurementPolicy();
    await writeFile(this.info.outputPath(`procurement-owned-${this.scenario}.json`), JSON.stringify({
      qaId, runId, siteId, expiresAt, backend, marker: this.marker, entries: this.entries,
      cleanup: 'Retain immutable procurement objects until explicitly authorized exact QA group destruction. No per-record cleanup.',
    }, null, 2), { mode: 0o600 });
  }
}

export async function tenderDetail(page: Page, id: string): Promise<ProcurementDetail> {
  const { siteId } = procurementPolicy();
  requireUuid(id, 'Tender');
  const result = await procurementApi(page, `/api/procurement/tenders/${id}?site_id=${siteId}`);
  expect(result.status).toBe(200);
  expect(result.body.tender.id).toBe(id);
  expect(result.body.tender.site_id).toBe(siteId);
  return result.body;
}

export async function resolveTender(page: Page, journal: ProcurementJournal, title = journal.marker) {
  const { siteId } = procurementPolicy();
  const result = await procurementApi(page, `/api/procurement/tenders?site_id=${siteId}&search=${encodeURIComponent(title)}`);
  expect(result.status).toBe(200);
  const matches = result.body.tenders.filter((row: Tender) => row.title === title);
  expect(matches).toHaveLength(1);
  expect(matches[0].site_id).toBe(siteId);
  await journal.record('tender', matches[0].id);
  return tenderDetail(page, matches[0].id);
}

export async function setupTender(page: Page, journal: ProcurementJournal, options: { participation?: TenderDocument['participation']; mapped?: boolean; opening?: TenderDocument['opening_policy']; closesInMs?: number } = {}) {
  const policy = procurementPolicy();
  const deadline = new Date(Date.now() + (options.closesInMs ?? 86400000)).toISOString();
  const document: TenderDocument = { title: journal.marker, description: 'Synthetic QA tender; no actual purchase or provider fulfillment.',
    request_id: null, currency: 'USD', visibility: 'public', global_visible: false,
    participation: options.participation ?? 'open', opening_policy: options.opening ?? 'on_receipt',
    participation_deadline: deadline, opening_at: options.closesInMs ? deadline : new Date(Date.now() + 172800000).toISOString(),
    requirements: [{ id: crypto.randomUUID(), description: `${journal.marker} specification`, quantity: 2, unit: 'unit', unit_net_minor: 125,
      catalog_item_id: options.mapped ? policy.catalogItemId : null }] };
  await journal.record('tender');
  const result = await procurementApi(page, `/api/procurement/tenders?site_id=${policy.siteId}`, 'POST', { expected_version: 0, document });
  expect(result.status).toBe(200);
  await journal.record('tender', result.body.id);
  const detail = await tenderDetail(page, result.body.id);
  expect(detail.tender.title).toBe(journal.marker);
  expect(detail.tender.requirements).toEqual(document.requirements);
  return detail;
}

export async function publishTender(page: Page, detail: ProcurementDetail, journal: ProcurementJournal) {
  await page.goto(`/purchases/tenders/${detail.tender.id}`);
  await expect(page.getByRole('heading', { name: detail.tender.title, exact: true, level: 2 })).toBeVisible();
  await journal.record('publication-approval');
  await journal.record('application-policy-bootstrap-if-absent');
  const response = page.waitForResponse(res => res.url().includes(`/tenders/${detail.tender.id}/publish?`) && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Request publication', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  const body = await result.json();
  await journal.record('publication-approval', body.approval_id);
  if (body.status === 'pending') {
    const approvals = await procurementApi(page, `/api/procurement/approvals?site_id=${procurementPolicy().siteId}&target_id=${detail.tender.id}`);
    expect(approvals.status).toBe(200);
    const approval = approvals.body.approvals.find((row: { id: string }) => row.id === body.approval_id);
    expect(approval.event).toBe('publication');
    expect(approval.target_version).toBe(detail.tender.version);
    expect(approval.procurement_event_stages).toHaveLength(1);
    const stage = approval.procurement_event_stages[0];
    expect(stage.status).toBe('pending');
    expect(stage.definition.decisionMode).toBe('human');
    expect(stage.definition.allowSelfApproval).toBe(true);
    await page.getByRole('tab', { name: 'Approvals', exact: true }).click();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve stage', exact: true });
    await dialog.getByRole('textbox').fill(`${journal.marker}: synthetic QA publication reviewed`);
    const decision = page.waitForResponse(res => res.url().includes(`/approvals/${body.approval_id}/decisions?`) && res.request().method() === 'POST');
    await journal.record('publication-decision');
    await dialog.getByRole('button', { name: 'Confirm decision', exact: true }).click();
    expect((await decision).status()).toBe(200);
    await expect(dialog).toBeHidden();
  } else expect(body.status).toBe('published');
  await expect.poll(async () => (await tenderDetail(page, detail.tender.id)).publications.length).toBe(1);
  const saved = await tenderDetail(page, detail.tender.id);
  expect(saved.publications[0].version).toBe(detail.tender.version);
  expect(saved.publications[0].snapshot.title).toBe(detail.tender.title);
  await journal.record('publication', saved.publications[0].id);
  return saved;
}