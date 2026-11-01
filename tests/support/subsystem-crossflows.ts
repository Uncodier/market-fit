import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { fixtureClient, bindBrowserFixture } from './mutation-fixtures';
import { required, requireUuid } from './mutation-safety';
import { qaModulePolicy } from './qa-module-policy';
import { assertWorkspace, dismissConsent, selectWorkspace } from './workspace';

type Backend = Awaited<ReturnType<typeof fixtureClient>>;
export type CrossflowFixture = Backend & {
  lead: { id: string; name: string; email: string | null; buyer_user_id: string | null };
};
type Quote = { id: string; site_id: string; lead_id: string; purpose: string; notes: string | null; status: string };
export type QuoteHandle = { quote: Quote; cleanup(): Promise<void> };

/** Retain both original errors when cleanup also fails; never mask the primary failure. */
export async function withCrossflowCleanup(work: () => Promise<void>, cleanup: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (primary) {
    try { await cleanup(); } catch (cleanupError) {
      const message = (error: unknown) => error instanceof Error ? error.message : String(error);
      const combined = new Error(`Primary workflow failure: ${message(primary)}; cleanup failure: ${message(cleanupError)}`);
      Object.assign(combined, { primaryError: primary, cleanupError });
      throw combined;
    }
    throw primary;
  }
  await cleanup();
}

/** Validate actual server-owned QA metadata, not only an operator's flags. */
export function assertQaBinding(metadata: unknown, qaId: string, expiresAt: string): void {
  const value = metadata as Record<string, unknown> | null;
  if (!value || value.qa_fixture !== 'market-fit-qa-v1' || value.qa_environment_id !== qaId ||
      value.qa_expires_at !== expiresAt) throw new Error('Persisted disposable QA binding does not match');
}

export async function crossflowFixture(page: Page): Promise<CrossflowFixture> {
  const policy = qaModulePolicy();
  if (process.env.TEST_SUITE !== 'subsystems') throw new Error('Crossflows require TEST_SUITE=subsystems');
  const backend = await fixtureClient();
  const user = await backend.client.auth.getUser();
  if (user.error || user.data.user?.id !== backend.userId) throw new Error('Fixture identity unavailable');
  assertQaBinding(user.data.user.app_metadata, policy.qaId, policy.expiresAt);
  const site = await backend.client.from('sites').select('description').eq('id', backend.siteId).single();
  if (site.error) throw new Error('QA workspace binding unavailable');
  let metadata: unknown;
  try { metadata = JSON.parse(site.data.description); } catch { throw new Error('QA workspace binding unavailable'); }
  assertQaBinding(metadata, policy.qaId, policy.expiresAt);
  const leads = await backend.client.from('leads').select('id,name,email,buyer_user_id,metadata')
    .eq('site_id', backend.siteId).eq('name', required(process.env, 'TEST_LEAD_NAME'));
  if (leads.error || leads.data?.length !== 1) throw new Error('QA lead must resolve exactly once in the selected workspace');
  const lead = leads.data[0];
  requireUuid(lead.id, 'QA lead ID');
  assertQaBinding(lead.metadata, policy.qaId, policy.expiresAt);
  await selectWorkspace(page);
  await bindBrowserFixture(page);
  return { ...backend, lead };
}

export async function gotoCrossflow(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'The actual workspace document must load').toBe(true);
  await dismissConsent(page);
  await assertWorkspace(page);
}

export async function assertExactLeadScreen(page: Page, fixture: CrossflowFixture): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/leads/${fixture.lead.id}$`));
  // The breadcrumb repeats the name as an h1. Only LeadIdentityHeader's actual
  // editable identity heading has the exact title attribute.
  const identity = page.getByRole('heading', { level: 1, name: fixture.lead.name, exact: true })
    .and(page.getByTitle(fixture.lead.name, { exact: true }));
  await expect(identity, 'The actual lead identity heading must be unique').toHaveCount(1);
  await expect(identity).toBeVisible();
  const persisted = await fixture.client.from('leads').select('id,name,email')
    .eq('site_id', fixture.siteId).eq('id', fixture.lead.id).single();
  expect(persisted.error).toBeNull();
  expect(persisted.data).toEqual({ id: fixture.lead.id, name: fixture.lead.name, email: fixture.lead.email });
}

export async function openExactLead(page: Page, fixture: CrossflowFixture): Promise<void> {
  await gotoCrossflow(page, `/leads/${fixture.lead.id}`);
  await assertExactLeadScreen(page, fixture);
}

/** Read the app's durable cart; never seed/patch React, localStorage or IndexedDB. */
export async function readPosSession(page: Page, siteId: string) {
  return page.evaluate(async id => {
    const databases = await indexedDB.databases();
    if (!databases.some(db => db.name === 'market-fit-pos')) return null;
    return new Promise<{ siteId: string; activeOrderId: string; cart: unknown[];
      leadValue: { id?: string; label?: string; mode?: string } | string | null } | null>((resolve, reject) => {
      const request = indexedDB.open('market-fit-pos');
      request.onerror = () => reject(new Error('POS database read failed'));
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cartSessions')) { db.close(); resolve(null); return; }
        const transaction = db.transaction('cartSessions', 'readonly');
        const read = transaction.objectStore('cartSessions').get(id);
        read.onsuccess = () => resolve(read.result || null);
        read.onerror = () => reject(new Error('POS session read failed'));
        transaction.oncomplete = () => db.close();
        transaction.onabort = () => { db.close(); reject(new Error('POS session read aborted')); };
      };
    });
  }, siteId);
}

export async function assertSelectedCustomer(page: Page, fixture: CrossflowFixture): Promise<void> {
  await expect.poll(async () => (await readPosSession(page, fixture.siteId))?.leadValue).toEqual({
    mode: 'existing', id: fixture.lead.id, label: fixture.lead.name,
  });
  const session = await readPosSession(page, fixture.siteId);
  expect(session?.siteId).toBe(fixture.siteId);
  expect(session?.activeOrderId).toBe('new');
  expect(session?.cart).toEqual([]);
  await assertWorkspace(page);
}

export function assertQuoteIdentity(quote: Quote, siteId: string, leadId: string, id: string): void {
  if (quote.id !== id || quote.site_id !== siteId || quote.lead_id !== leadId || quote.purpose !== 'sales') {
    throw new Error('Quotation identity or linked lead does not match');
  }
}

/** An optional shared quote is read-only. Otherwise provision only one empty draft. */
export async function quotationFixture(fixture: CrossflowFixture): Promise<QuoteHandle> {
  const policy = qaModulePolicy();
  const configuredId = process.env.TEST_QUOTATION_ID?.trim();
  const id = configuredId ? requireUuid(configuredId, 'TEST_QUOTATION_ID') : randomUUID();
  const marker = `QA subsystem quotation ${policy.runId} ${id}`;
  const read = () => fixture.client.from('quotations').select('id,site_id,lead_id,purpose,notes,status')
    .eq('site_id', fixture.siteId).eq('id', id);
  const cleanup = async () => {
    if (configuredId) return; // Never delete or modify a supplied shared fixture.
    qaModulePolicy(); // Expired/revoked authorization cannot silently permit cleanup writes.
    const found = await read();
    if (found.error) throw new Error('Run-owned quotation cleanup lookup failed');
    if (!found.data?.length) return;
    const quote = found.data[0] as Quote;
    assertQuoteIdentity(quote, fixture.siteId, fixture.lead.id, id);
    if (quote.notes !== marker || quote.status !== 'draft') {
      throw new Error('Quotation ownership changed; refusing cleanup');
    }
    const removed = await fixture.client.from('quotations').delete().eq('site_id', fixture.siteId)
      .eq('id', id).eq('lead_id', fixture.lead.id).eq('purpose', 'sales').eq('notes', marker).eq('status', 'draft').select('id');
    if (removed.error || removed.data?.length !== 1 || removed.data[0].id !== id) throw new Error('Exact quotation cleanup failed');
    const absent = await read();
    if (absent.error || absent.data?.length !== 0) throw new Error('Quotation cleanup absence not verified');
  };
  let handle: QuoteHandle | undefined;
  await withCrossflowCleanup(async () => {
    if (!configuredId) {
      // Public-key authenticated admin client + RLS; no service role, deal, items or token.
      const inserted = await fixture.client.from('quotations').insert({ id, site_id: fixture.siteId,
        lead_id: fixture.lead.id, buyer_user_id: fixture.lead.buyer_user_id, notes: marker,
        purpose: 'sales', status: 'draft', currency: 'USD', total: 0, tax_total: 0 }).select('id');
      if (inserted.error || inserted.data?.length !== 1 || inserted.data[0].id !== id) {
        throw new Error('Run-owned quotation setup failed');
      }
    }
    const result = await read();
    if (result.error || result.data?.length !== 1) throw new Error('Quotation fixture must resolve exactly once');
    const quote = result.data[0] as Quote;
    assertQuoteIdentity(quote, fixture.siteId, fixture.lead.id, id);
    handle = { quote, cleanup };
  }, async () => {
    // Only failed setup needs reconciliation; successful setup hands cleanup to its caller.
    if (!handle) await cleanup();
  });
  return handle!;
}

export async function assertQuotationScreen(page: Page, fixture: CrossflowFixture, quote: Quote): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/quotations/${quote.id}$`));
  // The breadcrumb is level 1 and uses "Quote <prefix>"; the invoice is level 2
  // with "#<prefix>". Require uniqueness rather than taking a transient first match.
  const identity = page.getByRole('heading', { level: 2, name: `#${quote.id.slice(0, 8)}`, exact: true });
  await expect(identity).toHaveCount(1);
  await expect(identity).toBeVisible();
  const billTo = page.getByRole('heading', { level: 3, name: 'Bill To', exact: true }).locator('..');
  await expect(billTo.getByText(fixture.lead.name, { exact: true })).toBeVisible();
  if (quote.notes) await expect(page.getByText(quote.notes, { exact: true })).toBeVisible();
  const persisted = await fixture.client.from('quotations').select('id,site_id,lead_id,purpose,notes,status')
    .eq('site_id', fixture.siteId).eq('id', quote.id).single();
  expect(persisted.error).toBeNull();
  expect(persisted.data).toEqual(quote);
  assertQuoteIdentity(persisted.data as Quote, fixture.siteId, fixture.lead.id, quote.id);
  await assertWorkspace(page);
}