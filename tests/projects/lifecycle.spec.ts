import { test, expect, type Page } from '@playwright/test';
import { dismissConsent, selectWorkspace } from '../support/workspace';
import { required } from '../support/environment';
import { assertOwnedProject, type OwnedProject } from '../support/project-lifecycle-policy';
import { projectLifecycleClient, findOwnedProject, projectIsActive } from '../support/project-lifecycle-client';

async function assertSelected(page: Page, id: string, origin: string): Promise<void> {
  expect(new URL(page.url()).origin).toBe(origin);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('currentSiteId'))).toBe(id);
  await expect.poll(async () => (await page.context().cookies(origin))
    .find(cookie => cookie.name === 'mf_current_site_id')?.value).toBe(id);
}

test('owner creates a unique project and archives that same project with password confirmation', async ({ page }, testInfo) => {
  await selectWorkspace(page);
  const { client, userId, policy } = await projectLifecycleClient(page);
  expect(await findOwnedProject(client, userId), 'Run marker must not preexist').toBeNull();
  let project: OwnedProject | null = null;
  let creationAttempted = false;
  let archiveAttempted = false;
  let archiveConfirmed = false;
  let cleanupUsed = false;
  let submittedArchives = 0;
  // Guard the actual browser request as well as the selected-site UI/cache state.
  await page.context().route(url => url.pathname === '/api/sites/archive', async route => {
    let valid = false;
    try {
      const data = route.request().postDataJSON();
      const url = new URL(route.request().url());
      if (project) assertOwnedProject(project, userId);
      valid = Boolean(project && data.siteId === project.id && url.origin === policy.baseURL && !url.search &&
        route.request().method() === 'POST' && submittedArchives === 0);
    } catch { /* Fail closed without logging the password-bearing request. */ }
    if (!valid) { await route.abort('blockedbyclient'); return; }
    submittedArchives++;
    await route.continue();
  });
  try {
    const response = await page.goto('/create-site', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBe(true);
    await dismissConsent(page);
    // The deployed nested inputs are not associated with their visible labels.
    await page.getByPlaceholder('My Amazing Project', { exact: true }).fill(policy.marker);
    await page.getByPlaceholder('https://mysite.com', { exact: true }).fill(policy.url);
    await page.getByPlaceholder('Tell us about your project...', { exact: true })
      .fill('Synthetic Shiplight project lifecycle check. Archive after verification.');
    for (let step = 1; step < 8; step++) {
      await page.getByRole('button', { name: /^(Next|Skip)$/, exact: true }).click();
    }
    const create = page.getByRole('button', { name: 'Create Project', exact: true });
    await expect(create).toBeEnabled();
    // Capture the actual persisted ID, never infer it from whichever site is active.
    const inserted = page.waitForResponse(result => {
      const url = new URL(result.url());
      const trustedOrigin = url.origin === policy.backend ||
        (policy.target === 'production' && url.origin === 'https://db.makinari.com');
      return trustedOrigin && url.pathname === '/rest/v1/sites' && result.request().method() === 'POST';
    }, { timeout: 45_000 });
    creationAttempted = true;
    await create.click();
    const persisted = await inserted;
    expect(persisted.ok(), 'Site insertion must succeed').toBe(true);
    const rows = await persisted.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Site creation did not return one identifiable project');
    assertOwnedProject(rows[0], userId);
    project = { id: rows[0].id, name: rows[0].name, url: rows[0].url, user_id: rows[0].user_id };
    await expect(page.getByRole('button', { name: 'Go to Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
    expect(await findOwnedProject(client, userId)).toEqual(project);

    // Reload the chooser to prove persistence, not an optimistic provider update.
    await page.goto('/projects?manage=1', { waitUntil: 'domcontentloaded' });
    const select = page.getByRole('button', { name: `Select ${policy.marker}`, exact: true });
    await expect(select).toHaveCount(1);
    await select.click();
    await expect(page).toHaveURL(`${policy.baseURL}/robots`);
    await assertSelected(page, project!.id, policy.baseURL);
    await page.goto('/settings?tab=general', { waitUntil: 'domcontentloaded' });
    await assertSelected(page, project!.id, policy.baseURL);
    await page.getByRole('button', { name: 'Archive site', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Archive site', exact: true });
    await expect(dialog).toContainText(policy.marker);
    const archive = dialog.getByRole('button', { name: 'Archive site', exact: true });
    await expect(archive).toBeDisabled();
    // Cancellation must preserve both persisted state and the selected workspace.
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await projectIsActive(client, project!, userId)).toBe(true);
    await assertSelected(page, project!.id, policy.baseURL);
    await page.getByRole('button', { name: 'Archive site', exact: true }).click();
    await expect(dialog).toContainText(policy.marker);
    await dialog.getByLabel('Account password', { exact: true }).fill(required(process.env, 'TEST_ADMIN_PASSWORD'));
    assertOwnedProject(project!, userId);
    expect(await projectIsActive(client, project!, userId)).toBe(true);
    const archived = page.waitForResponse(result => new URL(result.url()).origin === policy.baseURL &&
      new URL(result.url()).pathname === '/api/sites/archive' && result.request().method() === 'POST');
    archiveAttempted = true;
    await archive.click();
    const result = await archived;
    expect(result.ok(), 'Password-confirmed archival must succeed').toBe(true);
    expect(await result.json()).toEqual({ success: true });
    archiveConfirmed = true;
    await page.waitForURL(url => url.origin === policy.baseURL && url.pathname === '/projects', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => projectIsActive(client, project!, userId)).toBe(false);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('currentSiteId'))).not.toBe(project!.id);
    await expect.poll(async () => (await page.context().cookies(policy.baseURL))
      .find(cookie => cookie.name === 'mf_current_site_id')?.value).not.toBe(project!.id);
    await page.goto('/projects?manage=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: `Select ${policy.marker}`, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Select ${policy.siteName}`, exact: true })).toHaveCount(1);
  } finally {
    try {
      // Never adopt a marker match without the ID returned by this creation response.
      if (!project && creationAttempted) throw new Error(`Creation identity unconfirmed for ${policy.marker}; manual follow-up required`);
      if (project && await projectIsActive(client, project, userId)) {
        if (archiveAttempted) throw new Error(`Archival unconfirmed for run-owned project ${project.id}; manual follow-up required, request not replayed`);
        assertOwnedProject(project, userId);
        cleanupUsed = true;
        archiveAttempted = true;
        const result = await page.request.post(`${policy.baseURL}/api/sites/archive`, {
          data: { siteId: project.id, password: required(process.env, 'TEST_ADMIN_PASSWORD') },
          failOnStatusCode: false, timeout: 30_000, maxRedirects: 0,
        });
        if (!result.ok() || (await result.json()).success !== true || await projectIsActive(client, project, userId)) {
          throw new Error(`Cleanup archival failed for run-owned project ${project.id}; manual follow-up required`);
        }
      }
    } finally {
      await testInfo.attach('project-lifecycle-evidence', {
        body: JSON.stringify({ runId: process.env.SHIPLIGHT_RUN_ID, projectId: project?.id ?? null,
          projectName: policy.marker, creationAttempted, archiveAttempted, archiveConfirmed, cleanupUsed }),
        contentType: 'application/json',
      });
    }
  }
});