import { expect, type Page, type Response } from '@playwright/test';
import { assertReadReady } from './read-assertions';
import { dismissConsent } from './workspace';

type FinderBody = { success?: boolean; error?: unknown; data?: unknown; [key: string]: unknown };

/** Reject provider failures even when HTTP 200 and the UI falls back to its initial prompt. */
export function finderData(body: FinderBody, kind: 'search' | 'totals') {
  if (!body || typeof body !== 'object' || body.success === false || body.error) {
    throw new Error(`People ${kind} provider failed`);
  }
  const data = (body.data ?? body) as FinderBody;
  if (!data || typeof data !== 'object' || data.success === false || data.error) {
    throw new Error(`People ${kind} provider failed`);
  }
  if (kind === 'search' && !Array.isArray(data.search_results)) {
    throw new Error('People search returned no results contract');
  }
  if (kind === 'totals' && (typeof data.total_persons !== 'number' || data.total_persons < 0)) {
    throw new Error('People totals returned no successful count');
  }
  return data;
}

async function readResponse(response: Response, kind: 'search' | 'totals') {
  expect(response.ok(), `People ${kind} request must succeed`).toBe(true);
  return finderData(await response.json(), kind);
}

export async function searchPeopleAndAssertResults(page: Page): Promise<void> {
  await dismissConsent(page);
  const search = page.getByRole('button', { name: 'Search', exact: true });
  await assertReadReady(page, '/people', search);
  await expect(search).toBeEnabled();
  const matches = (suffix: string) => (response: Response) =>
    new URL(response.url()).pathname === `/api/finder/person_role_search${suffix}` &&
    response.request().method() === 'POST';
  const [result, totals] = await Promise.all([
    page.waitForResponse(matches(''), { timeout: 45_000 }),
    page.waitForResponse(matches('/totals'), { timeout: 45_000 }),
    search.click(),
  ]);
  const data = await readResponse(result, 'search');
  const counts = await readResponse(totals, 'totals');
  await expect(search).toBeEnabled({ timeout: 45_000 });
  if ((data.search_results as unknown[]).length > 0) {
    expect(counts.total_persons).toBeGreaterThan(0);
    await assertReadReady(page, '/people', page.getByRole('columnheader', { name: 'Person Name', exact: true }));
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    await expect(page.getByText(/^Showing .+ people$/)).toBeVisible();
  } else {
    expect(counts.total_persons).toBe(0);
    // The current app instead shows its initial prompt for zero results. Fail until
    // it exposes completed-empty success; an available Search button is insufficient.
    await assertReadReady(page, '/people', page.getByText('No results', { exact: true }));
  }
}