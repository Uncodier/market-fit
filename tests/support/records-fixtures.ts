import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { test as base, expect, type TestInfo } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fixtureClient, bindBrowserFixture } from './mutation-fixtures';
import { assertQaBinding, withCrossflowCleanup } from './subsystem-crossflows';
import { selectWorkspace } from './workspace';
import { recordsPolicy } from './records-policy';

export type Field = { id: string; name: string; label?: string; type: string;
  required?: boolean; options?: string[]; relationTarget?: string; targetCategoryId?: string };
export type Category = { id: string; name: string; template_fields: Field[] };
type Backend = Awaited<ReturnType<typeof fixtureClient>>;
type Owned = { table: 'records' | 'record_categories'; id: string; siteId: string;
  marker: string; categoryId?: string; actor: 'admin' | 'foreign' };

export class RecordsFixture {
  readonly policy = recordsPolicy();
  readonly marker = `Records ${this.policy.runId} ${randomUUID()}`;
  private owned: Owned[] = [];
  private attempts: string[] = [];
  private cleanupState = 'pending QA teardown';
  constructor(readonly admin: Backend, readonly foreign: Backend, private info: TestInfo) {}

  async journal() {
    await writeFile(this.info.outputPath('records-owned.json'), JSON.stringify({
      marker: this.marker, owned: this.owned, unresolvedUiCreates: this.attempts,
      cleanupState: this.cleanupState,
    }, null, 2), { mode: 0o600 });
  }
  async own(entry: Owned) { this.owned.push(entry); await this.journal(); }
  async uiAttempt(category: Category) { this.attempts.push(category.id); await this.journal(); }
  async uiCreated(category: Category, id: string) {
    await this.own({ table: 'records', id, siteId: this.admin.siteId, categoryId: category.id,
      marker: '', actor: 'admin' });
    this.attempts = this.attempts.filter(value => value !== category.id);
    await this.journal();
  }
  async uiCategoryCreated(category: Category) {
    await this.own({ table: 'record_categories', id: category.id, siteId: this.admin.siteId,
      marker: category.name, actor: 'admin' });
    this.attempts = this.attempts.filter(value => value !== category.name);
    await this.journal();
  }
  async category(fields: Field[] = [], actor: 'admin' | 'foreign' = 'admin'): Promise<Category> {
    recordsPolicy();
    const row = { name: `${this.marker} category ${randomUUID()}`, template_fields: fields };
    const result = await this.insertOwned('record_categories', row, actor);
    expect(result.error, 'User-scoped category scaffold insert').toBeNull();
    expect(await this.read('record_categories', result.id!, actor)).toMatchObject(row);
    return { ...row, id: result.id! };
  }
  async insertRecord(category: Category, relations: Record<string, string> = {}, actor: 'admin' | 'foreign' = 'admin') {
    const title = `${this.marker} target ${randomUUID()}`;
    return { ...await this.insertOwned('records', { category_id: category.id, title, status: 'draft', data: {}, relations }, actor), title };
  }
  /** Generated IDs honor column-level grants. Durable intent precedes insertion. */
  private async insertOwned(table: Owned['table'], row: Record<string, unknown>, actor: 'admin' | 'foreign') {
    recordsPolicy();
    const backend = this[actor];
    const key = table === 'records' ? 'title' : 'name';
    const marker = String(row[key]);
    const lookup = () => backend.client.from(table).select('id').eq('site_id', backend.siteId).eq(key, marker);
    const absent = await lookup();
    expect(absent.error).toBeNull();
    expect(absent.data).toEqual([]);
    this.attempts.push(marker);
    await this.journal();
    const result = await backend.client.from(table).insert({ ...row, site_id: backend.siteId }).select('id').single();
    const found = await lookup();
    expect(found.error).toBeNull();
    expect(found.data!.length).toBeLessThanOrEqual(1);
    const id = found.data?.[0]?.id as string | undefined;
    if (id) {
      await this.own({ table, id, siteId: backend.siteId, marker, categoryId: row.category_id as string | undefined, actor });
    } else if (!result.error?.code) {
      throw new Error('Ambiguous insert completion; retaining unresolved intent for operator reconciliation');
    }
    this.attempts = this.attempts.filter(value => value !== marker);
    await this.journal();
    return { id, error: result.error, marker };
  }
  async record(category: Category, actor: 'admin' | 'foreign' = 'admin') {
    const result = await this.insertRecord(category, {}, actor);
    expect(result.error, 'User-scoped target scaffold insert').toBeNull();
    expect(await this.read('records', result.id!, actor)).toMatchObject({ title: result.title, category_id: category.id });
    return { id: result.id!, title: result.title };
  }
  async read(table: Owned['table'], id: string, actor: 'admin' | 'foreign' = 'admin') {
    const result = await this[actor].client.from(table).select('*').eq('site_id', this[actor].siteId).eq('id', id).single();
    expect(result.error, `Exact persisted ${table} read`).toBeNull();
    return result.data!;
  }
  async cleanup() {
    recordsPolicy();
    if (this.attempts.length) throw new Error('Unresolved UI creation: inspect exact run journal; refusing category cascade cleanup');
    // Records first, even when later categories were registered after earlier records.
    for (const table of ['records', 'record_categories'] as const) {
      for (const row of [...this.owned].reverse().filter(entry => entry.table === table)) {
        const client = this[row.actor].client;
        const found = await client.from(table).select('*').eq('site_id', row.siteId).eq('id', row.id);
        expect(found.error).toBeNull();
        const trash = await client.rpc('list_record_trash', { p_site_id: row.siteId });
        expect(trash.error, 'Manager Trash visibility is required to reconcile cleanup').toBeNull();
        if (!found.data?.length) continue; // Absent or already trashed; ownership remains pending QA teardown.
        expect(found.data).toHaveLength(1);
        if (table === 'records') {
          expect(found.data[0].category_id).toBe(row.categoryId);
          if (row.marker) expect(found.data[0].title).toBe(row.marker);
        } else {
          expect(found.data[0].name).toBe(row.marker);
          const children = await client.from('records').select('id').eq('site_id', row.siteId).eq('category_id', row.id);
          expect(children.error).toBeNull();
          expect(children.data, 'Never cascade-trash unknown records').toEqual([]);
          const categories = await client.from('record_categories').select('id').eq('site_id', row.siteId).eq('parent_category_id', row.id);
          expect(categories.error).toBeNull();
          expect(categories.data, 'Never cascade-trash unknown categories').toEqual([]);
          const hiddenChildren = (trash.data || []).filter((item: { kind: string; category_id?: string; parent_category_id?: string }) =>
            item.kind === 'record' ? item.category_id === row.id : item.parent_category_id === row.id);
          for (const child of hiddenChildren) {
            expect(this.owned.some(entry => entry.id === child.id && entry.siteId === row.siteId
              && entry.table === (child.kind === 'record' ? 'records' : 'record_categories')),
            'Unknown trashed children still prevent broad cleanup').toBe(true);
          }
        }
        const removed = await client.rpc(table === 'records' ? 'trash_record' : 'trash_record_category',
          table === 'records' ? { p_record_id: row.id } : { p_category_id: row.id });
        expect(removed.error).toBeNull();
        const absent = await client.from(table).select('id').eq('site_id', row.siteId).eq('id', row.id);
        expect(absent.error).toBeNull();
        expect(absent.data).toEqual([]);
        const retained = await client.rpc('list_record_trash', { p_site_id: row.siteId });
        expect(retained.error).toBeNull();
        expect(retained.data.some((item: { id: string; kind: string }) => item.id === row.id
          && item.kind === (table === 'records' ? 'record' : 'category'))).toBe(true);
      }
    }
    this.cleanupState = 'active reads absent; pending QA teardown';
    await this.journal(); // Soft trash is not permanent teardown. Never discard captured IDs.
  }
}

async function verifyBinding(backend: Backend, role: string) {
  const policy = recordsPolicy();
  const user = await backend.client.auth.getUser();
  expect(user.error).toBeNull();
  expect(user.data.user?.app_metadata.qa_role).toBe(role);
  assertQaBinding(user.data.user?.app_metadata, policy.qaId, policy.expiresAt);
  const site = await backend.client.from('sites').select('description').eq('id', backend.siteId).single();
  expect(site.error).toBeNull();
  assertQaBinding(JSON.parse(site.data!.description), policy.qaId, policy.expiresAt);
  const profile = await backend.client.from('profiles').select('language').eq('id', backend.userId).single();
  expect(profile.error).toBeNull();
  expect(profile.data?.language, 'Installer must supply English QA profiles; suite never changes shared preferences').toBe('en');
  const restriction = await backend.client.rpc('current_user_has_location_restrictions');
  expect(restriction.error, 'Unrestricted Records fixtures require the installed location gate').toBeNull();
  expect(restriction.data).toBe(false);
}

export async function verifyTargets(client: SupabaseClient, siteId: string, userId: string) {
  const policy = recordsPolicy();
  const lead = await client.from('leads').select('id,company_id,metadata').eq('site_id', siteId)
    .eq('name', process.env.TEST_LEAD_NAME!).single();
  expect(lead.error).toBeNull();
  assertQaBinding(lead.data!.metadata, policy.qaId, policy.expiresAt);
  const company = await client.from('companies').select('id,name,industry').eq('id', lead.data!.company_id).single();
  expect(company.error).toBeNull();
  expect(company.data!.name.startsWith(`${policy.qaId} `)).toBe(true);
  const supplier = await client.from('suppliers').select('id,name').eq('site_id', siteId).eq('id', policy.supplierId).single();
  expect(supplier.error).toBeNull();
  expect(supplier.data!.name).toBe(process.env.TEST_RECORDS_SUPPLIER_NAME);
  const order = await client.from('sale_orders').select('id,order_number,total,status').eq('site_id', siteId).eq('id', policy.orderId).single();
  expect(order.error).toBeNull();
  expect(order.data!.order_number).toBe(process.env.TEST_RECORDS_ORDER_NUMBER);
  const member = await client.from('site_members').select('id,user_id,name,email,role,status,license_suspended,manually_disabled')
    .eq('site_id', siteId).eq('user_id', userId).single();
  expect(member.error).toBeNull();
  expect(member.data!.status).toBe('active');
  expect(member.data!.license_suspended).not.toBe(true);
  expect(member.data!.manually_disabled).not.toBe(true);
  expect(member.data!.id).not.toBe(member.data!.user_id);
  expect(member.data!.name).toBeTruthy();
  for (const label of [supplier.data!.name, company.data!.name, order.data!.order_number, member.data!.name]) {
    expect(label.length, 'Fixture labels must fit the actual preview label contract').toBeLessThanOrEqual(80);
  }
  expect(company.data!.industry).toBeTruthy();
  expect(order.data!.total).not.toBeNull();
  return { supplier: supplier.data!, company: company.data!, order: order.data!, member: member.data! };
}

export const test = base.extend<{ records: RecordsFixture }>({
  records: async ({ page }, use, info) => {
    const policy = recordsPolicy();
    const admin = await fixtureClient();
    const foreign = await fixtureClient({ ...process.env, TEST_SITE_ID: policy.foreignSiteId,
      TEST_SITE_NAME: process.env.TEST_FOREIGN_SITE_NAME, TEST_ADMIN_EMAIL: process.env.TEST_FOREIGN_EMAIL,
      TEST_ADMIN_PASSWORD: process.env.TEST_FOREIGN_PASSWORD });
    await verifyBinding(admin, 'admin');
    await verifyBinding(foreign, 'foreign');
    await verifyTargets(admin.client, admin.siteId, admin.userId); // All fixtures fail closed before any writes.
    await selectWorkspace(page);
    await bindBrowserFixture(page);
    const fixture = new RecordsFixture(admin, foreign, info);
    await withCrossflowCleanup(() => use(fixture), () => fixture.cleanup());
  },
});
export { expect };