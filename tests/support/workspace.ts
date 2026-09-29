import { expect, type Page } from '@playwright/test';
import { readEnvironment } from './environment';
import { startReadObservation } from './read-observation';

/** Interact with the actual consent dialog; never remove overlays or force clicks. */
export async function dismissConsent(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Privacy Settings', exact: true });
  if (!await dialog.isVisible()) return;
  const reject = dialog.getByRole('button', { name: /^(Reject All|Only necessary|Necessary only)$/i });
  const accept = dialog.getByRole('button', { name: 'Accept All', exact: true });
  if (await reject.isVisible()) await reject.click();
  else await accept.click();
  await expect(dialog).toBeHidden();
}

export async function assertWorkspace(page: Page): Promise<void> {
  const { baseURL, siteId } = readEnvironment();
  expect(new URL(page.url()).origin).toBe(baseURL);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('currentSiteId'))).toBe(siteId);
  await expect.poll(async () => {
    const cookies = await page.context().cookies(baseURL);
    return cookies.find(cookie => cookie.name === 'mf_current_site_id')?.value;
  }).toBe(siteId);
}

export async function selectWorkspace(page: Page): Promise<void> {
  const { baseURL, siteName } = readEnvironment();
  startReadObservation(page);
  // Manage mode prevents an old active workspace from redirecting before selection.
  const response = await page.goto(`${baseURL}/projects?manage=1`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'Project chooser must load successfully').toBe(true);
  const select = page.getByRole('button', { name: `Select ${siteName}`, exact: true });
  await expect(select, 'The dedicated workspace must exist exactly once').toHaveCount(1);
  await expect(select).toBeVisible();
  await dismissConsent(page);
  await select.click();
  await expect(page).toHaveURL(new RegExp(`^${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/robots(?:[?#]|$)`));
  await assertWorkspace(page);
}