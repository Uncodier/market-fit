import { expect, type Locator, type Page } from '@playwright/test';

const READ_ERROR = /^(?:Application error|Internal Server Error|This page could not be found|Access denied|Unauthorized|Forbidden|Error (?:loading|fetching)|Failed to (?:load|fetch)|Unable to (?:load|fetch)|Something went wrong|No site selected|Select a (?:site|project) first)/i;

/** Navigation alone and the absence of an error title are not success evidence. */
export async function assertReadReady(page: Page, target: string, proof: Locator): Promise<void> {
  const base = process.env.TEST_BASE_URL;
  if (!base) throw new Error('TEST_BASE_URL is required');
  const expected = new URL(target, base);
  await expect(page).toHaveURL(url => url.origin === expected.origin &&
    url.pathname === expected.pathname && [...expected.searchParams].every(
      ([key, value]) => url.searchParams.get(key) === value,
    ));
  await expect(proof).toBeVisible({ timeout: 30_000 });
  // Skeletons in this app use animate-pulse; keep this a hard gate, not WAIT_UNTIL.
  await expect(page.locator('.animate-pulse:visible, [aria-busy="true"]:visible'))
    .toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/^(?:Loading(?: .*)?|Searching)[.…]+$/i).filter({ visible: true }))
    .toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('[data-sonner-toast][data-type="error"]:visible')).toHaveCount(0);
  await expect(page.getByText(READ_ERROR).filter({ visible: true })).toHaveCount(0);
  await expect(proof).toBeVisible();
}

export function requiredReadFixture(name: string, env = process.env): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function commerceUrl(path: string, env = process.env): string {
  const base = new URL(requiredReadFixture('TEST_COMMERCE_BASE_URL', env));
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash) {
    throw new Error('TEST_COMMERCE_BASE_URL must be an HTTP(S) origin');
  }
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected a commerce path');
  const target = new URL(path, base);
  if (target.origin !== base.origin) throw new Error('Commerce navigation must stay on the configured host');
  return target.href;
}

export function commerceFixtures(env = process.env) {
  const slug = requiredReadFixture('TEST_SHOP_SLUG', env);
  const itemId = requiredReadFixture('TEST_CATALOG_ITEM_ID', env);
  const itemName = requiredReadFixture('TEST_CATALOG_ITEM_NAME', env);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) throw new Error('TEST_SHOP_SLUG must be one URL segment');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    throw new Error('TEST_CATALOG_ITEM_ID must be a UUID');
  }
  commerceUrl('/marketplace', env);
  return { slug, itemId, itemName };
}

/** Both grid cards and featured posters link to the item; posters use aria-label. */
export function catalogItemLink(page: Page, href: string, name: string): Locator {
  const links = page.locator(`a[href="${href}"]`);
  return links.filter({ hasText: name }).or(
    links.and(page.getByRole('link', { name, exact: true })),
  ).filter({ visible: true }).first();
}