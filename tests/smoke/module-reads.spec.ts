import { test, expect, type Page } from '@playwright/test';
import { selectWorkspace, assertWorkspace, dismissConsent } from '../support/workspace';
import { startReadObservation, assertReadObservation, waitForObservedReads } from '../support/read-observation';
import { required } from '../support/environment';
import { localeMessages } from '../../app/context/locale-catalog';

test.beforeEach(async ({ page }) => { startReadObservation(page); });
test.afterEach(async ({ page }) => { await assertReadObservation(page); });

async function openModule(page: Page, route: string) {
  await selectWorkspace(page);
  await waitForObservedReads(page);
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === route);
  await dismissConsent(page);
  await settled(page);
  const language = await page.locator('html').getAttribute('lang');
  expect(language).toMatch(/^(en|es|fr|de|ja)(-|$)/);
  const locale = language!.split('-')[0] as keyof typeof localeMessages;
  return (key: string) => {
    const label = localeMessages[locale][key];
    expect(label, `Current catalog must define ${key}`).toBeTruthy();
    return label;
  };
}

async function settled(page: Page) {
  await expect(page.locator('.animate-pulse:visible')).toHaveCount(0, { timeout: 45_000 });
  await waitForObservedReads(page);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await assertWorkspace(page);
}

async function emptySearch(page: Page, searchLabel: string, emptyLabel: string) {
  const search = page.getByPlaceholder(searchLabel, { exact: true }).filter({ visible: true });
  await expect(search).toHaveCount(1);
  await expect(search).toBeVisible();
  await search.fill(`e2e-no-module-match-${required(process.env, 'SHIPLIGHT_RUN_ID')}`);
  await expect(page.getByText(emptyLabel, { exact: true })).toBeVisible({ timeout: 45_000 });
  await settled(page);
  await search.fill('');
  await expect(search).toHaveValue('');
  await settled(page);
}

async function readTab(page: Page, label: string) {
  await waitForObservedReads(page);
  const tab = page.getByRole('tab', { name: label, exact: true }).filter({ visible: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await settled(page);
}

test('Suppliers reads the directory and restores a no-match search', async ({ page }) => {
  const t = await openModule(page, '/suppliers');
  await expect(page.getByRole('main').getByRole('heading', { name: t('procurement.partners.suppliers.title'), exact: true })).toBeVisible();
  await emptySearch(page, t('procurement.partners.suppliers.search'), t('procurement.partners.suppliers.empty'));
});

test('Purchase Requests reads the list and restores a no-match search', async ({ page }) => {
  const t = await openModule(page, '/purchases/requests');
  await expect(page.getByRole('heading', { name: t('procurement.workflow.request.requests'), exact: true })).toBeVisible();
  await emptySearch(page, t('procurement.workflow.request.search'), t('procurement.workflow.request.empty'));
});

test('Approvals reads pending and all-status inboxes without decisions', async ({ page }) => {
  const t = await openModule(page, '/purchases/procurement/approvals');
  const title = t('procurement.partners.approvals.inboxTitle');
  const result = page.getByRole('table', { name: title, exact: true })
    .or(page.getByText(t('procurement.partners.approvals.emptyFilters'), { exact: true }));
  await expect(result).toBeVisible();
  await readTab(page, t('procurement.partners.approvals.allStatuses'));
  await expect(result).toBeVisible();
  await readTab(page, t('procurement.values.pending'));
  await expect(result).toBeVisible();
});

test('Procurement Rules filters active policies and restores search without edits', async ({ page }) => {
  const t = await openModule(page, '/purchases/rules');
  await readTab(page, t('procurement.values.active'));
  await emptySearch(page, t('procurement.policy.rules.search'), t('procurement.policy.rules.empty'));
  await readTab(page, t('procurement.values.all'));
  await expect(page.getByText(t('procurement.policy.page.unsaved'), { exact: true })).toHaveCount(0);
});

test('Inventory Minimums filters enabled rules and restores a no-match search', async ({ page }) => {
  const t = await openModule(page, '/inventory/minimums');
  await readTab(page, t('procurement.workflow.replenishment.enabled'));
  await emptySearch(page, t('procurement.policy.rules.search'), t('procurement.workflow.replenishment.noRules'));
  await readTab(page, t('procurement.values.all'));
});

test('Assets reads image and document tabs and restores a no-match search', async ({ page }) => {
  const t = await openModule(page, '/assets');
  await readTab(page, t('assets.tabs.images'));
  await emptySearch(page, t('assets.searchPlaceholder'), t('assets.empty.images'));
  await readTab(page, t('assets.tabs.documents'));
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await readTab(page, t('assets.tabs.all'));
});

test('Costs reads summary and category reports without exporting', async ({ page }) => {
  await openModule(page, '/costs');
  await expect(page.getByRole('tabpanel', { name: 'Summary', exact: true })
    .getByRole('heading', { name: 'Costs', exact: true })).toBeVisible({ timeout: 45_000 });
  await readTab(page, 'Categories');
  await expect(page.getByRole('tabpanel', { name: 'Categories', exact: true })
    .getByRole('heading', { name: 'Costs', exact: true })).toBeVisible({ timeout: 45_000 });
  await readTab(page, 'Summary');
  await expect(page.getByRole('tabpanel', { name: 'Summary', exact: true })
    .getByRole('heading', { name: 'Costs', exact: true })).toBeVisible();
});

test('Team settings reads members and returns from Company without invitations', async ({ page }) => {
  const t = await openModule(page, '/settings?tab=team');
  await expect(page.locator('#team-members')).toBeVisible();
  await expect(page.locator('#team-members').getByRole('heading', { name: t('settings.nav.teamMembers'), exact: true })).toBeVisible();
  await readTab(page, t('settings.tabs.company'));
  await expect(page.locator('#company-profile')).toBeVisible();
  await readTab(page, t('settings.tabs.team'));
  await expect(page.locator('#team-members')).toBeVisible();
});

test('Company and Calendar settings read persisted sections without saves', async ({ page }) => {
  const t = await openModule(page, '/settings?tab=company');
  await expect(page.locator('#company-profile')).toBeVisible();
  await expect(page.getByPlaceholder(t('settings.company.profile.aboutPlaceholder'), { exact: true })).toBeVisible();
  await readTab(page, t('settings.tabs.calendar'));
  await expect(page.locator('#calendars').getByRole('heading', { name: 'Calendars', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Calendar', exact: true })).toBeVisible();
  await readTab(page, t('settings.tabs.company'));
  await expect(page.locator('#company-profile')).toBeVisible();
});

test('Calendar settings directly reads booking summaries without opening editors', async ({ page }) => {
  const t = await openModule(page, '/settings?tab=calendar');
  const calendars = page.locator('#calendars');
  await expect(calendars.getByRole('heading', { name: 'Calendars', exact: true })).toBeVisible();
  await expect(calendars.getByRole('button', { name: 'Add Calendar', exact: true })).toBeVisible();
  // Both the persisted empty state and booking summaries are valid read results.
  await expect(calendars.getByText('No calendars yet', { exact: true })
    .or(calendars.getByText(/^\/book\/.*\/rr\/.+/).first())).toBeVisible();
  await expect(calendars.locator('input[id^="rr-name-"]')).toHaveCount(0);
  await readTab(page, t('settings.tabs.company'));
  await expect(page.locator('#company-profile')).toBeVisible();
  await readTab(page, t('settings.tabs.calendar'));
  await expect(calendars).toBeVisible();
});

test('Procurement Settings reads policy and tender portal configuration without saves', async ({ page }) => {
  const t = await openModule(page, '/settings/procurement');
  await expect(page.getByRole('heading', { name: t('procurement.policy.page.settings'), exact: true })).toBeVisible();
  const general = page.locator('#procurement-settings-general');
  await expect(general).toBeVisible();
  await expect(general.getByLabel(t('procurement.policy.settings.timeZone'), { exact: true })).toHaveValue(/\S/);
  await expect(general.getByRole('combobox', { name: t('procurement.policy.settings.visibility'), exact: true })).toBeVisible();
  await expect(page.locator('#procurement-settings-fallback')).toBeVisible();
  const portal = page.locator('#procurement-settings-portal');
  await expect(portal).toBeVisible();
  await expect(portal.getByLabel(t('procurement.workflow.tender.enablePortal'), { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: t('procurement.policy.page.rules'), exact: true })).toHaveAttribute('href', '/purchases/rules');
  await expect(page.getByText(t('procurement.policy.page.unsaved'), { exact: true })).toHaveCount(0);
  await settled(page);
});