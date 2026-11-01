/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

jest.mock('@playwright/test', () => ({ expect: jest.fn() }));
jest.mock('../../tests/support/mutation-fixtures', () => ({ fixtureClient: jest.fn(), bindBrowserFixture: jest.fn() }));
jest.mock('../../tests/support/workspace', () => ({}));
jest.mock('../../tests/support/qa-module-policy', () => ({
  qaModulePolicy: jest.fn(() => ({ qaId: 'qa-offline', runId: 'qa-offline-subsystems-unit' })),
}));
import { assertQaBinding, assertQuoteIdentity, quotationFixture, withCrossflowCleanup, type CrossflowFixture } from '../../tests/support/subsystem-crossflows';

const qaId = 'qa-offline';
const expiresAt = '2099-01-01T00:00:00.000Z';
const binding = { qa_fixture: 'market-fit-qa-v1', qa_environment_id: qaId, qa_expires_at: expiresAt };
const quote = { id: 'quote', site_id: 'site', lead_id: 'lead', purpose: 'sales', notes: null, status: 'draft' };

describe('cross-screen strict identity contracts', () => {
  test('accepts only exact persisted QA ownership', () => {
    expect(() => assertQaBinding(binding, qaId, expiresAt)).not.toThrow();
  });
  test.each([
    null, {}, { ...binding, qa_fixture: 'production-smoke' },
    { ...binding, qa_environment_id: 'qa-foreign' }, { ...binding, qa_expires_at: '2000-01-01' },
  ])('rejects unverified, foreign or stale actual QA binding %#', metadata => {
    expect(() => assertQaBinding(metadata, qaId, expiresAt)).toThrow('Persisted disposable QA binding');
  });
  test('accepts exact sales quotation and lead identity', () => {
    expect(() => assertQuoteIdentity(quote, 'site', 'lead', 'quote')).not.toThrow();
  });
  test.each([
    { ...quote, id: 'another' }, { ...quote, site_id: 'foreign' },
    { ...quote, lead_id: 'same-name-different-id' }, { ...quote, purpose: 'procurement' },
  ])('rejects wrong quotation, tenant, customer or document kind %#', row => {
    expect(() => assertQuoteIdentity(row, 'site', 'lead', 'quote')).toThrow('Quotation identity');
  });
});

describe('quotation setup and exact ownership reconciliation', () => {
  const existingId = '11111111-1111-4111-8111-111111111111';
  const savedId = process.env.TEST_QUOTATION_ID;
  afterEach(() => {
    if (savedId === undefined) delete process.env.TEST_QUOTATION_ID;
    else process.env.TEST_QUOTATION_ID = savedId;
  });
  type Result = { data: unknown; error: unknown };
  function backend(responses: ((calls: Record<string, unknown[][]>) => Result)[]) {
    const queries: Record<string, unknown[][]>[] = [];
    const from = jest.fn(() => {
      const resolve = responses.shift();
      if (!resolve) throw new Error('Unexpected database operation');
      const calls: Record<string, unknown[][]> = {};
      queries.push(calls);
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'insert', 'delete']) {
        query[method] = (...args: unknown[]) => {
          (calls[method] ||= []).push(args);
          return query;
        };
      }
      query.then = (success: (result: Result) => unknown, failure: (error: unknown) => unknown) =>
        Promise.resolve(resolve(calls)).then(success, failure);
      return query;
    });
    const fixture = { client: { from }, siteId: 'site', userId: 'actor',
      lead: { id: 'lead', name: 'QA lead', email: null, buyer_user_id: null } } as unknown as CrossflowFixture;
    return { fixture, queries, from };
  }
  test('supplied fixture is read-only and never scheduled for deletion', async () => {
    process.env.TEST_QUOTATION_ID = existingId;
    const db = backend([() => ({ data: [{ ...quote, id: existingId }], error: null })]);
    const handle = await quotationFixture(db.fixture);
    await handle.cleanup();
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(db.queries[0].insert).toBeUndefined();
    expect(db.queries[0].delete).toBeUndefined();
  });
  test('empty draft setup and cleanup use only preallocated exact run-owned identity', async () => {
    delete process.env.TEST_QUOTATION_ID;
    let owned: typeof quote;
    const db = backend([
      calls => {
        owned = calls.insert[0][0] as typeof quote;
        return { data: [{ id: owned.id }], error: null };
      },
      () => ({ data: [owned], error: null }),
      () => ({ data: [owned], error: null }),
      () => ({ data: [{ id: owned.id }], error: null }),
      () => ({ data: [], error: null }),
    ]);
    const handle = await quotationFixture(db.fixture);
    await handle.cleanup();
    expect(handle.quote.notes).toContain('qa-offline-subsystems-unit');
    expect(handle.quote).not.toHaveProperty('title');
    expect(db.queries[3].eq).toEqual([
      ['site_id', 'site'], ['id', handle.quote.id], ['lead_id', 'lead'],
      ['purpose', 'sales'], ['notes', handle.quote.notes], ['status', 'draft'],
    ]);
    expect(db.queries[4].eq).toEqual([['site_id', 'site'], ['id', handle.quote.id]]);
  });
  test('changed run marker refuses deletion rather than cleaning another record', async () => {
    delete process.env.TEST_QUOTATION_ID;
    let owned: typeof quote;
    const db = backend([
      calls => { owned = calls.insert[0][0] as typeof quote; return { data: [{ id: owned.id }], error: null }; },
      () => ({ data: [owned], error: null }),
      () => ({ data: [{ ...owned, notes: 'Shared quotation' }], error: null }),
    ]);
    const handle = await quotationFixture(db.fixture);
    await expect(handle.cleanup()).rejects.toThrow('ownership changed');
    expect(db.queries.some(query => query.delete)).toBe(false);
  });
  test('ambiguous failed insert is reconciled by preallocated ID and never generic cleanup', async () => {
    delete process.env.TEST_QUOTATION_ID;
    let owned: typeof quote;
    const db = backend([
      calls => { owned = calls.insert[0][0] as typeof quote; return { data: null, error: { message: 'timeout' } }; },
      () => ({ data: [owned], error: null }),
      () => ({ data: [{ id: owned.id }], error: null }),
      () => ({ data: [], error: null }),
    ]);
    await expect(quotationFixture(db.fixture)).rejects.toThrow('setup failed');
    expect(db.queries[2].eq).toContainEqual(['id', owned!.id]);
    expect(db.queries[2].eq).toContainEqual(['notes', owned!.notes]);
    expect(db.from).toHaveBeenCalledTimes(4);
  });
  test('setup and cleanup lookup failures are both reported, not replaced by cleanup', async () => {
    delete process.env.TEST_QUOTATION_ID;
    const db = backend([
      () => ({ data: null, error: { code: '42703' } }),
      () => ({ data: null, error: { code: '42703' } }),
    ]);
    await expect(quotationFixture(db.fixture)).rejects.toThrow(
      'Primary workflow failure: Run-owned quotation setup failed; cleanup failure: Run-owned quotation cleanup lookup failed');
    expect(db.queries.some(query => query.delete)).toBe(false);
  });
});

describe('primary workflow failures survive cleanup failures', () => {
  test('retains both failures with clear labels and original error objects', async () => {
    const primary = new Error('Initial read failed');
    const cleanup = new Error('Cleanup lookup failed');
    const error = await withCrossflowCleanup(async () => { throw primary; }, async () => { throw cleanup; })
      .catch(value => value);
    expect(error.message).toBe('Primary workflow failure: Initial read failed; cleanup failure: Cleanup lookup failed');
    expect(error.primaryError).toBe(primary);
    expect(error.cleanupError).toBe(cleanup);
  });
  test('successful cleanup preserves the original primary error', async () => {
    const primary = new Error('Initial read failed');
    await expect(withCrossflowCleanup(async () => { throw primary; }, async () => {})).rejects.toBe(primary);
  });
  test('successful workflow still reports cleanup failure', async () => {
    const cleanup = new Error('Cleanup lookup failed');
    await expect(withCrossflowCleanup(async () => {}, async () => { throw cleanup; })).rejects.toBe(cleanup);
  });
});

describe('native crossflow safety source contracts', () => {
  const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  test('cleanup is exact id/site/lead/run marker/draft and verifies absence', () => {
    const helper = source('tests/support/subsystem-crossflows.ts');
    expect(helper).toContain('if (configuredId) return;');
    expect(helper).toContain(".eq('id', id).eq('lead_id', fixture.lead.id).eq('purpose', 'sales').eq('notes', marker).eq('status', 'draft')");
    expect(helper).toContain('absent.data?.length !== 0');
    expect(helper).toContain('await cleanup();');
    expect(source('tests/subsystems/lead-quotation.spec.ts')).toContain('}, handle.cleanup)');
  });
  test('sales quotation reads and writes conform to baseline/core columns, not an invented title', () => {
    // Baseline 076 CREATE TABLE public.quotations has notes but no title. The
    // core boundary migration adds purpose. Keep this column snapshot portable
    // when the separate installer checkout is not available in application CI.
    const baselineColumns = ['id', 'site_id', 'deal_id', 'lead_id', 'buyer_user_id', 'price_list_id',
      'status', 'valid_until', 'currency', 'notes', 'subtotal', 'discount_total', 'total', 'created_at',
      'updated_at', 'tax_total', 'public_access_token', 'public_access_token_expires_at',
      'public_access_token_revoked_at', 'checkout_claim_id', 'checkout_claimed_at', 'checkout_sale_id',
      'checkout_order_id', 'location_id'];
    const baselinePath = path.resolve(process.cwd(), '../makinari-db-scheme/bootstrap/supabase/migrations/20261027000116_qa_baseline_076.sql');
    if (fs.existsSync(baselinePath)) {
      const baseline = fs.readFileSync(baselinePath, 'utf8');
      const body = baseline.match(/CREATE TABLE public\.quotations \(([\s\S]*?)\n\);/)?.[1];
      expect(body).toBeDefined();
      const columns = body!.split('\n').map(line => line.trim().split(/\s+/)[0])
        .filter(name => name && name !== 'CONSTRAINT');
      expect(columns).toEqual(baselineColumns);
    }
    const boundary = source('supabase/migrations/20261027173000_procurement_quotation_boundary.sql');
    expect(boundary).toContain("ADD COLUMN purpose text NOT NULL DEFAULT 'sales'");
    const allowed = new Set([...baselineColumns, 'purpose']);
    const helper = source('tests/support/subsystem-crossflows.ts');
    const reads = helper.matchAll(/from\('quotations'\)\.select\('([^']+)'\)/g);
    for (const match of reads) for (const field of match[1].split(',')) expect(allowed.has(field)).toBe(true);
    const insert = helper.match(/from\('quotations'\)\.insert\(\{([\s\S]*?)\}\)\.select/)?.[1];
    expect(insert).toBeDefined();
    for (const match of insert!.matchAll(/(?:^|,)\s*([a-z_]+)\s*[:,]/g)) expect(allowed.has(match[1])).toBe(true);
    expect(helper).not.toMatch(/quote\.title|title: marker|eq\('title'/);
    expect(helper).toContain('notes: marker');
    expect(source('tests/subsystems/lead-quotation.spec.ts')).not.toContain('purpose,title');
  });
  test('POS asserts UUID, persistent existing mode and blank new cart without injecting state', () => {
    const helper = source('tests/support/subsystem-crossflows.ts');
    expect(helper).toContain("db.transaction('cartSessions', 'readonly')");
    expect(helper).toContain("mode: 'existing', id: fixture.lead.id, label: fixture.lead.name");
    expect(helper).not.toMatch(/localStorage\.setItem|objectStore\([^)]*\)\.(put|add|delete)/);
    const spec = source('tests/subsystems/pos-customer.spec.ts');
    expect(spec).toContain('page.reload(');
    expect(spec).toContain('openExactLead(page, fixture)');
  });
  test('two native browser scenarios avoid mocks, fuzzy first-row navigation and fixture deletion', () => {
    for (const name of ['pos-customer', 'lead-quotation']) {
      const spec = source(`tests/subsystems/${name}.spec.ts`);
      expect(spec).toContain("from '@playwright/test'");
      expect(spec).not.toMatch(/page\.route|route\.fulfill|test\.skip|force: true|waitForTimeout/);
      expect(spec.match(/\btest\('/g)).toHaveLength(1);
    }
  });
  test('selected customer asserts the actual shared icon wrapper and child SVG', () => {
    const spec = source('tests/subsystems/pos-customer.spec.ts');
    expect(spec).toContain("const selectedCheck = customer.locator('.text-primary')");
    expect(spec).toContain('await expect(selectedCheck).toBeVisible()');
    expect(spec).toContain("await expect(selectedCheck.locator('svg')).toHaveCount(1)");
    expect(spec).not.toContain("customer.locator('svg').last()");
    const wrapper = source('app/components/ui/icons/icon-wrapper.tsx');
    expect(wrapper).toMatch(/<span\s+className=\{`[^`]*\$\{className\}/);
    const picker = source('app/pos/components/PosCustomerPickerDialog.tsx');
    expect(picker).toMatch(/currentLeadId === lead.id\s*\?\s*\(\s*<Check className="h-4 w-4 text-primary"/);
  });
  test('cold chooser navigation waits up to 45 seconds without bypassing exact selection', () => {
    const helper = source('tests/support/workspace.ts');
    expect(helper).toContain('name: `Select ${siteName}`, exact: true');
    expect(helper).toContain('await select.click()');
    expect(helper).toContain('/robots(?:[?#]|$)`), { timeout: 45_000 }');
    expect(helper).toContain('await assertWorkspace(page)');
    expect(helper).not.toContain('page.goto(`${baseURL}/robots');
  });
  test('lead screen and history return anchor the actual titled identity rather than duplicate breadcrumbs', () => {
    const helper = source('tests/support/subsystem-crossflows.ts');
    expect(helper).toContain(".and(page.getByTitle(fixture.lead.name, { exact: true }))");
    expect(helper).toContain("'The actual lead identity heading must be unique').toHaveCount(1)");
    const header = source('app/leads/components/LeadIdentityHeader.tsx');
    expect(header).toMatch(/<h1[\s\S]*?title=\{lead.name\}[\s\S]*?\{lead.name\}[\s\S]*?<\/h1>/);
    const spec = source('tests/subsystems/lead-quotation.spec.ts');
    expect(spec).toContain('await assertExactLeadScreen(page, fixture)');
    expect(spec).not.toContain("getByRole('heading', { level: 1");
  });
  test('quotation identity is unique and customer assertion is scoped to actual Bill To block', () => {
    const helper = source('tests/support/subsystem-crossflows.ts');
    expect(helper).toContain("level: 2, name: `#${quote.id.slice(0, 8)}`, exact: true");
    expect(helper).toContain("level: 3, name: 'Bill To', exact: true }).locator('..')");
    expect(helper).toContain('await expect(identity).toHaveCount(1)');
    expect(helper).toContain('billTo.getByText(fixture.lead.name, { exact: true })');
    const invoice = source('app/quotations/components/QuotationInvoice.tsx');
    expect(invoice).toMatch(/<h2[^>]*>\s*#\{quotation.id.substring\(0, 8\)\}/);
    expect(invoice).toContain('t("billTo")');
    expect(invoice).toContain('{billTo.primary}');
  });
});