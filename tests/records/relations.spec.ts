import { test, expect, verifyTargets } from '../support/records-fixtures';
import { chooseRelation, createRecordUI, reloadRecord, saveRecord, searchRecordRelation } from '../support/records-ui';

test('category-specific picker excludes other categories and persists the exact Record link', async ({ page, records }) => {
  const allowedCategory = await records.category();
  const wrongCategory = await records.category();
  const allowed = await records.record(allowedCategory);
  const wrong = await records.record(wrongCategory);
  const source = await records.category([{ id: 'link', name: 'linked', label: 'Linked record',
    type: 'relation', relationTarget: 'record', targetCategoryId: allowedCategory.id }]);
  const record = await createRecordUI(page, records, source);
  const picker = page.getByRole('textbox', { name: 'Linked record', exact: true });
  await searchRecordRelation(page, wrong.title, wrong.id);
  await chooseRelation(page, 'Linked record', allowed.title);
  await saveRecord(page, records, record.id, { relations: { linked: allowed.id } });
  await reloadRecord(page, record.title);
  await expect(picker).toHaveValue(allowed.title);
  await page.getByRole('radio', { name: 'Relations', exact: true }).click();
  const link = page.locator(`a[href="/records/${allowed.id}"]`);
  await expect(link).toContainText(allowed.title.length > 80 ? `${allowed.title.slice(0, 80).trim()}…` : allowed.title);
  await expect(page.locator(`a[href="/records/${wrong.id}"]`)).toHaveCount(0);
});

test('foreign run-owned Record stays absent from the main-site picker, detail and RLS reads', async ({ page, records }) => {
  const foreignCategory = await records.category([], 'foreign');
  const foreign = await records.record(foreignCategory, 'foreign');
  const category = await records.category([{ id: 'link', name: 'linked', label: 'Linked record', type: 'relation', relationTarget: 'record' }]);
  const local = await records.record(category);
  const subject = await createRecordUI(page, records, category);
  await searchRecordRelation(page, foreign.title, foreign.id);
  await chooseRelation(page, 'Linked record', local.title);
  await saveRecord(page, records, subject.id, { relations: { linked: local.id } });
  const denied = await records.admin.client.from('records').select('id,title').eq('id', foreign.id);
  expect(denied.error).toBeNull();
  expect(denied.data).toEqual([]);
  await page.goto(`/records/${foreign.id}`);
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByPlaceholder('Record Title', { exact: true })).toHaveCount(0);
  await expect(page.getByText(foreign.title, { exact: true })).toHaveCount(0);
  expect(await records.read('records', foreign.id, 'foreign')).toMatchObject({ title: foreign.title, relations: {} });
  await page.goto(`/records/${subject.id}`);
  await expect(page.getByRole('textbox', { name: 'Linked record', exact: true })).toHaveValue(local.title);
});

test('supplier and site-associated global company resolve actual preview labels after UI selection', async ({ page, records }) => {
  const targets = await verifyTargets(records.admin.client, records.admin.siteId, records.admin.userId);
  const category = await records.category([
    { id: 'supplier', name: 'vendor', label: 'Vendor', type: 'relation', relationTarget: 'supplier' },
    { id: 'company', name: 'organization', label: 'Organization', type: 'relation', relationTarget: 'company' },
  ]);
  const record = await createRecordUI(page, records, category);
  await chooseRelation(page, 'Vendor', targets.supplier.name);
  await chooseRelation(page, 'Organization', targets.company.name);
  await saveRecord(page, records, record.id, { relations: { vendor: targets.supplier.id, organization: targets.company.id } });
  await reloadRecord(page, record.title);
  await expect(page.getByRole('textbox', { name: 'Vendor', exact: true })).toHaveValue(targets.supplier.name);
  await expect(page.getByRole('textbox', { name: 'Organization', exact: true })).toHaveValue(targets.company.name);
  await page.getByRole('radio', { name: 'Relations', exact: true }).click();
  const panel = page.getByText('Explicit Relations', { exact: true }).locator('..');
  await expect(panel.getByText(targets.supplier.name, { exact: true })).toBeVisible();
  await expect(panel.getByText(targets.company.name, { exact: true })).toBeVisible();
  await expect(panel.getByText(targets.company.industry, { exact: true })).toBeVisible();
});

test('sales-order preview uses sale_orders and member link persists user_id rather than membership ID', async ({ page, records }) => {
  const targets = await verifyTargets(records.admin.client, records.admin.siteId, records.admin.userId);
  const category = await records.category([
    { id: 'order', name: 'order', label: 'Order', type: 'relation', relationTarget: 'sales_order' },
    { id: 'member', name: 'assignee', label: 'Assignee', type: 'relation', relationTarget: 'team_member' },
  ]);
  const record = await createRecordUI(page, records, category);
  await chooseRelation(page, 'Order', targets.order.order_number);
  await chooseRelation(page, 'Assignee', targets.member.name);
  await saveRecord(page, records, record.id, { relations: { order: targets.order.id, assignee: targets.member.user_id } });
  expect((await records.read('records', record.id)).relations.assignee).not.toBe(targets.member.id);
  await reloadRecord(page, record.title);
  await expect(page.getByRole('textbox', { name: 'Order', exact: true })).toHaveValue(targets.order.order_number);
  await expect(page.getByRole('textbox', { name: 'Assignee', exact: true })).toHaveValue(targets.member.name);
  await page.getByRole('radio', { name: 'Relations', exact: true }).click();
  const panel = page.getByText('Explicit Relations', { exact: true }).locator('..');
  await expect(panel.getByText(targets.order.order_number, { exact: true })).toBeVisible();
  await expect(panel.getByText(targets.member.name, { exact: true })).toBeVisible();
  await expect(panel.getByText(targets.member.email, { exact: true })).toBeVisible();
  const total = panel.getByText('Total', { exact: true }).locator('..');
  await expect(total).toHaveText(`Total${Number.isInteger(targets.order.total)
    ? String(targets.order.total) : Number(targets.order.total).toLocaleString()}`);
});