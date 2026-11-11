import { randomUUID } from 'node:crypto';
import { test, expect, verifyTargets } from '../support/records-fixtures';

// These exercise the real public Data API under RLS, NOT UI/server-action behavior.
test('DB admission accepts same-site/category Record links and active membership user IDs', async ({ records }) => {
  const targetCategory = await records.category();
  const target = await records.record(targetCategory);
  const targets = await verifyTargets(records.admin.client, records.admin.siteId, records.admin.userId);
  const category = await records.category([
    { id: 'link', name: 'linked', type: 'relation', relationTarget: 'record', targetCategoryId: targetCategory.id },
    { id: 'member', name: 'assignee', type: 'relation', relationTarget: 'team_member' },
  ]);
  const inserted = await records.insertRecord(category, { linked: target.id });
  expect(inserted.error).toBeNull();
  const id = inserted.id!;
  expect((await records.read('records', id)).relations).toEqual({ linked: target.id });
  const updated = await records.admin.client.from('records').update({ relations: { linked: target.id, assignee: targets.member.user_id } })
    .eq('site_id', records.admin.siteId).eq('id', id).select('id');
  expect(updated.error).toBeNull();
  expect(updated.data).toEqual([{ id }]);
  expect((await records.read('records', id)).relations).toEqual({ linked: target.id, assignee: targets.member.user_id });
});

test('DB admission rejects wrong-category, foreign, missing, membership-row and undeclared links atomically', async ({ records }) => {
  const targetCategory = await records.category();
  const target = await records.record(targetCategory);
  const wrong = await records.record(await records.category());
  const foreign = await records.record(await records.category([], 'foreign'), 'foreign');
  const targets = await verifyTargets(records.admin.client, records.admin.siteId, records.admin.userId);
  const category = await records.category([
    { id: 'link', name: 'linked', type: 'relation', relationTarget: 'record', targetCategoryId: targetCategory.id },
    { id: 'member', name: 'assignee', type: 'relation', relationTarget: 'team_member' },
  ]);
  const subject = await records.record(category);
  const initial = await records.admin.client.from('records').update({ relations: { linked: target.id } })
    .eq('site_id', records.admin.siteId).eq('id', subject.id).select('id');
  expect(initial.error).toBeNull();
  expect(initial.data).toEqual([{ id: subject.id }]);
  const before = await records.read('records', subject.id);
  for (const relations of [{ linked: wrong.id }, { linked: foreign.id }, { linked: randomUUID() },
    { assignee: targets.member.id }, { undeclared: target.id }]) {
    const result = await records.admin.client.from('records').update({ relations }).eq('site_id', records.admin.siteId).eq('id', subject.id);
    expect(result.error?.code, 'Must be relation constraint denial, not an arbitrary transport/RLS failure').toBe('23514');
    expect(result.error?.message).toMatch(/Record relation target not found or access denied|Unknown record relation field/);
    const after = await records.read('records', subject.id);
    expect(after.relations).toEqual(before.relations);
    expect(after.updated_at).toBe(before.updated_at);
  }
  const rejected = await records.insertRecord(category, { linked: wrong.id });
  expect(rejected.error?.code).toBe('23514');
  expect(rejected.error?.message).toBe('Record relation target not found or access denied');
  expect(rejected.id).toBeUndefined();
  const absent = await records.admin.client.from('records').select('id').eq('site_id', records.admin.siteId).eq('title', rejected.title);
  expect(absent.error).toBeNull();
  expect(absent.data).toEqual([]);
});