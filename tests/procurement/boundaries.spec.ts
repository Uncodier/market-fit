import { test, expect } from '@playwright/test';
import { selectWorkspace } from '../support/workspace';
import { procurementPolicy } from '../support/procurement-policy';
import { procurementApi, procurementLogin, verifyProcurementAdmin, ProcurementJournal, setupTender, publishTender, tenderDetail } from '../support/procurement-fixtures';
import { publicTenderPath } from '../support/procurement-ui';

test('anonymous, collaborator and foreign tenant cannot manage a buyer tender; forged business and restricted participation deny', async ({ page, browser }, info) => {
  await selectWorkspace(page);
  await verifyProcurementAdmin(page);
  const journal = new ProcurementJournal(info, 'denied-boundaries');
  const detail = await publishTender(page, await setupTender(page, journal, { participation: 'invitation_only' }), journal);
  const policy = procurementPolicy();
  const contexts = [];
  try {
    for (const role of ['anonymous', 'collaborator', 'foreign', 'buyer'] as const) {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      contexts.push(context);
      const actor = await context.newPage();
      if (role === 'anonymous') await actor.goto(`${policy.baseURL}${publicTenderPath(detail)}`);
      else await procurementLogin(actor, role);
      const path = `/api/procurement/tenders/${detail.tender.id}?site_id=${policy.siteId}`;
      expect((await procurementApi(actor, path)).status).toBe(role === 'anonymous' ? 401 : 403);
      const cancelled = await procurementApi(actor, path, 'PATCH', { action: 'cancel', expected_version: detail.tender.version });
      expect(cancelled.status).toBe(role === 'anonymous' ? 401 : 403);
      const registration = await procurementApi(actor, '/api/procurement/credentials/participation/register', 'POST', { publication_id: detail.publications[0].id });
      expect(registration.status).toBe(role === 'anonymous' ? 401 : 403);
    }
    const openJournal = new ProcurementJournal(info, 'forged-business');
    const open = await publishTender(page, await setupTender(page, openJournal), openJournal);
    const buyer = await contexts[3].newPage();
    await buyer.goto(`${policy.baseURL}/home/submissions`);
    const forged = await procurementApi(buyer, '/api/procurement/credentials/participation/register', 'POST', {
      publication_id: open.publications[0].id, acting_site_id: policy.foreignSiteId,
    });
    expect(forged.status).toBe(403);
    const invalid = await procurementApi(page, `/api/procurement/tenders/${detail.tender.id}?site_id=${policy.siteId}`, 'PUT', {
      expected_version: detail.tender.version + 1, document: {
        title: detail.tender.title, description: detail.tender.description, request_id: detail.tender.request_id,
        currency: detail.tender.currency, visibility: detail.tender.visibility, global_visible: detail.tender.global_visible,
        participation: detail.tender.participation, opening_policy: detail.tender.opening_policy,
        participation_deadline: detail.tender.participation_deadline, opening_at: detail.tender.opening_at, requirements: detail.tender.requirements,
      },
    });
    expect(invalid.status).toBe(409);
    const after = await tenderDetail(page, detail.tender.id);
    expect(after.tender).toEqual(detail.tender);
    expect(after.publications).toEqual(detail.publications);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});