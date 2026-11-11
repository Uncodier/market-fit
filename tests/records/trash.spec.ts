import { test, expect, type RecordsFixture } from '../support/records-fixtures';
import { editCategory, recordsList } from '../support/records-ui';

async function trashItems(records: RecordsFixture) {
  const result = await records.admin.client.rpc('list_record_trash', { p_site_id: records.admin.siteId });
  expect(result.error, 'Trash RPC must be installed and authorized').toBeNull();
  return result.data as { id: string; kind: string; deletion_root_category_id: string | null }[];
}

async function expectAbsent(records: RecordsFixture, table: 'records' | 'record_categories', id: string) {
  const result = await records.admin.client.from(table).select('id').eq('site_id', records.admin.siteId).eq('id', id);
  expect(result.error).toBeNull();
  expect(result.data).toEqual([]);
}

test('collection Trash restores its batch but leaves previously trashed records untouched', async ({ page, records }) => {
  const category = await records.category();
  const child = await records.category();
  const linked = await records.admin.client.from('record_categories').update({ parent_category_id: category.id })
    .eq('site_id', records.admin.siteId).eq('id', child.id);
  expect(linked.error).toBeNull();
  const record = await records.record(category);
  const descendant = await records.record(child);
  const earlier = await records.record(category);
  const pretrash = await records.admin.client.rpc('trash_record', { p_record_id: earlier.id });
  expect(pretrash.error).toBeNull();

  const editor = await editCategory(page, category);
  await editor.getByRole('button', { name: 'Delete collection', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Move collection to Trash?', exact: true });
  await expect(confirmation).toContainText('including records hidden by your current filters');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await records.read('records', record.id)).title).toBe(record.title);
  await editor.getByRole('button', { name: 'Delete collection', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Move collection to Trash', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('button', { name: category.name, exact: true })).toHaveCount(0);
  await expectAbsent(records, 'records', record.id);
  await expectAbsent(records, 'records', descendant.id);
  await expectAbsent(records, 'record_categories', child.id);
  expect(await trashItems(records)).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: category.id, deletion_root_category_id: category.id }),
    expect.objectContaining({ id: earlier.id, deletion_root_category_id: null }),
  ]));

  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  const trash = page.getByRole('dialog', { name: 'Records Trash', exact: true });
  await expect(trash.getByRole('button', { name: `Restore ${record.title}`, exact: true })).toHaveCount(0);
  await trash.getByRole('button', { name: `Restore ${category.name}`, exact: true }).click();
  await expect(trash.getByRole('button', { name: `Restore ${category.name}`, exact: true })).toHaveCount(0);
  expect((await records.read('records', record.id)).title).toBe(record.title);
  expect((await records.read('records', descendant.id)).title).toBe(descendant.title);
  expect((await records.read('record_categories', child.id)).parent_category_id).toBe(category.id);
  await expectAbsent(records, 'records', earlier.id);
  await expect(trash.getByRole('button', { name: `Restore ${earlier.title}`, exact: true })).toBeVisible();
  await trash.getByRole('button', { name: `Restore ${earlier.title}`, exact: true }).click();
  await expect.poll(() => records.read('records', earlier.id)).toMatchObject({ title: earlier.title });
  await recordsList(page);
  await expect(page.getByRole('button', { name: category.name, exact: true })).toBeVisible();
});