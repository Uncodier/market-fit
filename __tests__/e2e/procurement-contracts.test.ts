/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const source = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('native procurement journeys stay aligned with real implementation contracts', () => {
  it('uses native Playwright specs with no AI steps, interceptions, blind cleanup or skips', () => {
    const files = readdirSync(path.join(root, 'tests/procurement')).filter(name => name.endsWith('.spec.ts'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) {
      const text = source(`tests/procurement/${file}`);
      expect(text).toContain("from '@playwright/test'");
      expect(text).not.toMatch(/shiplight|\.route\(|route\.fulfill|test\.skip|waitForTimeout|force:\s*true/);
      expect(text).toContain('ProcurementJournal');
    }
    expect(source('tests/support/procurement-fixtures.ts')).not.toMatch(/\.delete\(|service_role|createServiceClient/);
    expect(source('tests/support/procurement-fixtures.ts')).toContain('creation-attempted');
    expect(source('tests/support/procurement-fixtures.ts')).toContain('mode: 0o600');
  });
  it('uses real buyer quotation detail navigation, price inputs and published tender CTA', () => {
    expect(source('app/purchases/procurement/commerce/ProcurementQuotesPanel.tsx')).toContain('router.push(`/purchases/quotes/');
    expect(source('tests/support/procurement-ui.ts')).toContain('/purchases/quotes/${id}');
    expect(source('app/home/submissions/submission-form.tsx')).toContain('id={`price-${line.id}`}');
    expect(source('app/home/submissions/submission-shell.tsx')).toContain('data-submission-checkout');
    expect(source('app/context/locales/procurement/portal-en.json')).toContain('Submit immutable quotation');
  });
  it('does not mistake pre-closing award denial or nullable tax for an order', () => {
    const sql = source('supabase/migrations/20261030190000_procurement_free_text_quotations.sql');
    expect(sql).toContain("(pub.snapshot->>'participation_deadline')::timestamptz>clock_timestamp()");
    expect(sql).toContain('Quotation catalog mapping and taxes must be resolved before ordering');
    expect(source('app/purchases/quotes/quotation-detail.tsx')).toContain("event={quotation.award_id ? 'order' : 'award'}");
    expect(source('tests/procurement/participation.spec.ts')).toContain("'Award cannot bypass published closing/opening clocks'");
  });
  it('saves drafts to the actual authenticated persistence endpoint, never fabricated local state', () => {
    expect(source('app/home/submissions/use-submission-draft.ts')).toContain("const endpoint = '/api/procurement/credentials/drafts'");
    expect(source('tests/procurement/participation.spec.ts')).toContain('saved.body.draft_revision');
    expect(source('tests/procurement/participation.spec.ts')).toContain("applicant_key=personal");
  });
  it('creates suppliers as prospect before explicitly approving the exact owned supplier', () => {
    expect(source('app/api/procurement/suppliers/save.ts')).toContain('parsed.data.status !== "prospect"');
    expect(source('tests/support/procurement-expansion.ts')).toContain('expected_version: supplier.version');
    expect(source('tests/procurement/invitations-amendment.spec.ts')).toContain('Register invitation');
    expect(source('tests/procurement/invitations-amendment.spec.ts')).toContain('Withdraw invitation');
    expect(source('tests/procurement/invitations-amendment.spec.ts')).toContain('final.publications[1]).toEqual(first.publications[0])');
  });
  it('shares a specific in-flow certification revision without granting other applicants file access', () => {
    const text = source('tests/procurement/certification-sharing.spec.ts');
    expect(text).toContain('Upload personal credential');
    expect(text).toContain('submitted.request().postDataJSON().evidence');
    expect(text).toContain('fileStatus(foreign, body.revision_id)).status).toBe(404)');
    expect(source('tests/procurement/rejection.spec.ts')).toContain('duplicate.status).toBe(409)');
  });
  it('targets the workspace entity h2 and public main/header h1, never duplicate breadcrumb or screen-reader headings', () => {
    const workspace = source('app/purchases/tenders/tender-detail.tsx');
    expect(workspace).toContain('<h2 className="break-words text-xl font-semibold">{tender.title}</h2>');
    expect(workspace).toContain('<h1 className="sr-only">');
    expect(source('tests/support/procurement-fixtures.ts')).toContain("name: detail.tender.title, exact: true, level: 2");
    expect(source('app/tenders/detail-view.tsx')).toMatch(/<main[^>]*>[\s\S]*<header[^>]*>[\s\S]*<h1[^>]*>\{terms.title\}<\/h1>/);
    const publicFiles = ['tests/support/procurement-ui.ts', 'tests/procurement/tender-ui.spec.ts',
      'tests/procurement/participation.spec.ts', 'tests/procurement/invitations-amendment.spec.ts'];
    for (const file of publicFiles) {
      const text = source(file);
      expect(text).toContain("locator('main > header').getByRole('heading'");
      for (const line of text.split('\n').filter(row => row.includes("getByRole('heading'"))) {
        expect(line).toContain('level: 1');
        expect(line).not.toContain('.first()');
      }
    }
  });
  it('accepts streamed not-found status only with settled rendered denial and an independent anonymous public RPC absence', () => {
    const helper = source('tests/support/procurement-ui.ts');
    expect(source('app/tenders/not-found.tsx')).toContain("t('procurement.portal.public.notFound')");
    expect(helper).toContain('`${policy.commerceBaseURL}${publicTenderPath(detail)}`');
    expect(helper).toContain('toHaveURL(url)');
    expect(helper).toContain("name: 'Tender not found', exact: true, level: 1");
    expect(helper).toContain('This publication is not available in the public directory.');
    expect(helper).toContain('expect(detail.publications');
    expect(helper).toContain("anonymous.rpc('public_procurement_tenders'");
    expect(helper).toContain("p_site_slug: portal.data!.slug, p_tender_slug: detail.tender.portal_slug, p_page: 0, p_search: ''");
    expect(helper).toContain('expect(result.error');
    expect(helper).toContain('toEqual([])');
    expect(source('tests/procurement/tender-ui.spec.ts')).toContain('assertPublicTenderUnavailable(publicPage, created)');
    expect(source('tests/procurement/rejection.spec.ts')).toContain('assertPublicTenderUnavailable(guest, detail)');
  });
  it('selects only the accessible open proposal dialog, not retained aria-hidden Radix sheets', () => {
    const helper = source('tests/support/procurement-ui.ts');
    expect(helper).toContain("const sheet = page.getByRole('dialog', { name: 'Submit proposal', exact: true })");
    expect(helper).toContain('expect(sheet).toHaveCount(1)');
    expect(helper).toContain("expect(sheet).toHaveAttribute('data-submission-checkout', 'true')");
    expect(helper).toContain("expect(sheet).toHaveAttribute('data-state', 'open')");
    expect(helper).toContain('expect(sheet).toBeVisible()');
    const files = readdirSync(path.join(root, 'tests/procurement')).filter(name => name.endsWith('.spec.ts'));
    for (const file of ['tests/support/procurement-ui.ts', ...files.map(name => `tests/procurement/${name}`)]) {
      expect(source(file)).not.toContain("locator('[data-submission-checkout]')");
    }
  });
  it('waits for named edit dialog hydration and confirms exact update response before navigation', () => {
    const helper = source('tests/support/procurement-expansion.ts');
    expect(helper).toContain("getByRole('dialog', { name: 'Edit tender', exact: true })");
    expect(helper).toContain('toHaveValue(expectedTitle, { timeout: 45_000 })');
    expect(helper).toContain("getByRole('textbox', { name: 'Public description and terms', exact: true })).toBeEnabled({ timeout: 45_000 })");
    expect(helper).toContain("res.request().method() === 'PUT'");
    expect(helper).toContain('expect(saved.status()).toBe(200)');
    expect(helper).toContain('expect((await saved.json()).id).toBe(tenderId)');
    for (const file of ['tests/procurement/tender-ui.spec.ts', 'tests/procurement/invitations-amendment.spec.ts']) {
      expect(source(file)).toContain('await readyTenderEditor(page,');
      expect(source(file)).toContain('await saveTenderEditor(page, created.tender.id)');
      expect(source(file)).not.toContain("getByLabel('Public description and terms'");
    }
    const mapped = source('tests/procurement/mapped-order.spec.ts');
    expect(mapped).toContain("getByRole('link', { name: 'Open tender', exact: true })");
    expect(mapped).toContain("toHaveAttribute('href', `/purchases/tenders/${detail.tender.id}`)");
    expect(mapped).toContain('`/purchases/quotes/${id}(?:[?#]|$)`');
  });
  it('uses textbox accessible names for populated implicit-label textareas, never label text including saved content', () => {
    expect(source('app/purchases/tenders/tender-editor.tsx')).toContain("<label className=\"block\">{t('procurement.workflow.tender.publicDescription')}<Textarea");
    for (const file of ['tests/support/procurement-expansion.ts', 'tests/procurement/tender-ui.spec.ts', 'tests/procurement/invitations-amendment.spec.ts']) {
      const text = source(file);
      expect(text).toContain("getByRole('textbox', { name: 'Public description and terms', exact: true })");
      expect(text).not.toContain("getByLabel('Public description and terms'");
    }
  });
});