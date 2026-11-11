/** @jest-environment node */
import { RecordsFixture } from '../../tests/support/records-fixtures';
import { writeFile } from 'node:fs/promises';

jest.mock('@playwright/test', () => ({
  test: { extend: jest.fn(() => ({})) },
  expect: (value: unknown) => expect(value),
}));
jest.mock('node:fs/promises', () => ({ writeFile: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../tests/support/records-policy', () => ({ recordsPolicy: jest.fn(() => ({ runId: 'qa-unit-records-unit' })) }));
jest.mock('../../tests/support/mutation-fixtures', () => ({ fixtureClient: jest.fn(), bindBrowserFixture: jest.fn() }));
jest.mock('../../tests/support/subsystem-crossflows', () => ({ assertQaBinding: jest.fn(), withCrossflowCleanup: jest.fn() }));
jest.mock('../../tests/support/workspace', () => ({ selectWorkspace: jest.fn() }));

type Row = Record<string, unknown>;
function harness(initial: Record<string, Row[]> = {}) {
  const rows = structuredClone(initial);
  const deleted: Array<{ table: string; filters: Record<string, unknown> }> = [];
  const from = jest.fn((table: string) => {
    const filters: Record<string, unknown> = {};
    let remove = false;
    let projection = '*';
    const query = {
      select: jest.fn((fields: string): unknown => { projection = fields; return query; }),
      eq: jest.fn((key: string, value: unknown): unknown => { filters[key] = value; return query; }),
      delete: jest.fn((): unknown => { remove = true; return query; }),
      then: (resolve: (value: unknown) => unknown) => {
        const matched = (rows[table] || []).filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
        if (remove) {
          deleted.push({ table, filters: { ...filters } });
          rows[table] = (rows[table] || []).filter(row => !matched.includes(row));
        }
        const data = projection === 'id' ? matched.map(row => ({ id: row.id })) : matched;
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  });
  const trashed: Row[] = [];
  const rpc = jest.fn(async (name: string, args: Record<string, string>) => {
    if (name === 'list_record_trash') return { data: trashed, error: null };
    const table = name === 'trash_record' ? 'records' : 'record_categories';
    const id = args.p_record_id || args.p_category_id;
    const row = (rows[table] || []).find(item => item.id === id);
    if (row) {
      rows[table] = rows[table].filter(item => item.id !== id);
      trashed.push({ ...row, kind: table === 'records' ? 'record' : 'category', deleted_at: '2026-11-11T00:00:00Z' });
    }
    return { data: { success: true }, error: null };
  });
  const backend = { client: { from, rpc }, siteId: 'site', userId: 'actor' };
  const fixture = new RecordsFixture(backend as never, backend as never, { outputPath: () => '/tmp/not-written-unit.json' } as never);
  return { fixture, deleted, from, rpc, trashed };
}

beforeEach(() => jest.clearAllMocks());

it('journals ownership privately before any cleanup operation', async () => {
  const { fixture, from } = harness();
  await fixture.own({ table: 'records', id: 'record', siteId: 'site', categoryId: 'category', marker: 'owned', actor: 'admin' });
  expect(writeFile).toHaveBeenCalledWith('/tmp/not-written-unit.json', expect.stringContaining('owned'), { mode: 0o600 });
  expect(from).not.toHaveBeenCalled();
});

it('blocks cleanup on unresolved creation without issuing a delete', async () => {
  const { fixture, from } = harness();
  await fixture.uiAttempt({ id: 'category', name: 'owned', template_fields: [] });
  await expect(fixture.cleanup()).rejects.toThrow(/Unresolved UI creation/);
  expect(from).not.toHaveBeenCalled();
});

it('trashes records before categories and retains exact IDs pending permanent QA teardown', async () => {
  const { fixture, deleted, rpc } = harness({
    records: [{ id: 'record', site_id: 'site', category_id: 'category', title: 'owned record' }],
    record_categories: [{ id: 'category', site_id: 'site', name: 'owned category' }],
  });
  await fixture.own({ table: 'record_categories', id: 'category', siteId: 'site', marker: 'owned category', actor: 'admin' });
  await fixture.own({ table: 'records', id: 'record', siteId: 'site', categoryId: 'category', marker: 'owned record', actor: 'admin' });
  await fixture.cleanup();
  expect(deleted).toEqual([]);
  expect(rpc.mock.calls.filter(([name]) => name !== 'list_record_trash')).toEqual([
    ['trash_record', { p_record_id: 'record' }],
    ['trash_record_category', { p_category_id: 'category' }],
  ]);
  const journal = JSON.parse(jest.mocked(writeFile).mock.calls.at(-1)![1] as string);
  expect(journal.cleanupState).toBe('active reads absent; pending QA teardown');
  expect(journal.owned.map((row: Row) => row.id)).toEqual(['category', 'record']);
});

it('refuses category deletion when an unowned record remains', async () => {
  const { fixture, deleted } = harness({
    records: [{ id: 'foreign-record', site_id: 'site', category_id: 'category' }],
    record_categories: [{ id: 'category', site_id: 'site', name: 'owned' }],
  });
  await fixture.own({ table: 'record_categories', id: 'category', siteId: 'site', marker: 'owned', actor: 'admin' });
  await expect(fixture.cleanup()).rejects.toThrow();
  expect(deleted).toEqual([]);
});

it('refuses cleanup when the captured record ownership marker changed', async () => {
  const { fixture, deleted } = harness({ records: [{ id: 'record', site_id: 'site', category_id: 'category', title: 'changed' }] });
  await fixture.own({ table: 'records', id: 'record', siteId: 'site', categoryId: 'category', marker: 'owned', actor: 'admin' });
  await expect(fixture.cleanup()).rejects.toThrow();
  expect(deleted).toEqual([]);
});

it.each(['record', 'category'])('blocks category cleanup with an unowned trashed %s child', async kind => {
  const { fixture, rpc, trashed } = harness({ record_categories: [{ id: 'category', site_id: 'site', name: 'owned' }] });
  trashed.push({ id: 'unknown', kind, category_id: kind === 'record' ? 'category' : null,
    parent_category_id: kind === 'category' ? 'category' : null });
  await fixture.own({ table: 'record_categories', id: 'category', siteId: 'site', marker: 'owned', actor: 'admin' });
  await expect(fixture.cleanup()).rejects.toThrow();
  expect(rpc.mock.calls.every(([name]) => name === 'list_record_trash')).toBe(true);
});

it('retains already trashed record IDs without attempting physical cleanup', async () => {
  const { fixture, rpc, trashed, deleted } = harness();
  trashed.push({ id: 'record', kind: 'record', category_id: 'category' });
  await fixture.own({ table: 'records', id: 'record', siteId: 'site', categoryId: 'category', marker: 'owned', actor: 'admin' });
  await fixture.cleanup();
  expect(deleted).toEqual([]);
  expect(rpc).toHaveBeenCalledWith('list_record_trash', { p_site_id: 'site' });
  expect(jest.mocked(writeFile).mock.calls.at(-1)![1]).toContain('pending QA teardown');
  expect(jest.mocked(writeFile).mock.calls.at(-1)![1]).toContain('"id": "record"');
});

it('blocks category cleanup with an unowned active child category', async () => {
  const { fixture, rpc } = harness({ record_categories: [
    { id: 'category', site_id: 'site', name: 'owned' },
    { id: 'unknown', site_id: 'site', parent_category_id: 'category' },
  ] });
  await fixture.own({ table: 'record_categories', id: 'category', siteId: 'site', marker: 'owned', actor: 'admin' });
  await expect(fixture.cleanup()).rejects.toThrow();
  expect(rpc.mock.calls.every(([name]) => name === 'list_record_trash')).toBe(true);
});