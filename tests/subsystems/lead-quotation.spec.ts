import { test, expect } from '@playwright/test';
import {
  assertExactLeadScreen, assertQuotationScreen, crossflowFixture, openExactLead, quotationFixture, withCrossflowCleanup,
} from '../support/subsystem-crossflows';

test('exact CRM lead commerce opens its linked sales quotation and retains both identities on return', async ({ page }) => {
  const fixture = await crossflowFixture(page);
  const handle = await quotationFixture(fixture);
  await withCrossflowCleanup(async () => {
    await openExactLead(page, fixture);
    await page.getByRole('tab', { name: 'Commerce', exact: true }).click();
    const commerce = page.getByRole('region', { name: 'Customer commerce', exact: true });
    await expect(commerce).toBeVisible();
    await commerce.getByRole('tab', { name: 'Quotations', exact: true }).click();
    const link = commerce.locator(`a[href="/quotations/${handle.quote.id}"]`);
    // Supplied fixtures may be older than the first page; never choose another quote.
    for (let pageNumber = 1; pageNumber <= 100; pageNumber++) {
      // This control is enabled only for a settled result in the current scope.
      await expect(commerce.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
      await expect(commerce.getByRole('status')).toHaveCount(0);
      await expect(commerce.getByRole('alert')).toHaveCount(0);
      if (await link.count() === 1) break;
      const next = commerce.getByRole('button', { name: 'Next', exact: true });
      await expect(next, 'The exact linked quotation must exist on an accessible page').toBeEnabled();
      await next.click();
      await expect(commerce).toContainText(`Page ${pageNumber + 1}`);
    }
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText(`Quote ${handle.quote.id.slice(0, 8)}`);
    await link.click();
    await assertQuotationScreen(page, fixture, handle.quote);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertQuotationScreen(page, fixture, handle.quote);

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await assertExactLeadScreen(page, fixture);
    // Server-side exact identity, including lead_id, is rechecked after the cross-screen return.
    const persisted = await fixture.client.from('quotations').select('id,site_id,lead_id,purpose,notes,status')
      .eq('site_id', fixture.siteId).eq('id', handle.quote.id).single();
    expect(persisted.error).toBeNull();
    expect(persisted.data).toEqual(handle.quote);
  }, handle.cleanup);
});