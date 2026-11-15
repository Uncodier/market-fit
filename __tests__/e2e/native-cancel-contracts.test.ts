/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const recordPath = 'tests/records/delete-cancel.spec.ts';
const customerPath = 'tests/subsystems/pos-customer-cancel.spec.ts';

describe('isolated native cancellation case contracts (offline source evidence)', () => {
  it.each([recordPath, customerPath])('%s uses real controls without mocked responses or bypasses', path => {
    const spec = source(path);
    expect(spec.match(/\btest\('/g)).toHaveLength(1);
    expect(spec).not.toMatch(/page\.route|route\.fulfill|test\.(skip|fixme)|force: true|waitForTimeout|localStorage\.setItem/);
    expect(spec).not.toMatch(/\.from\([^)]*\)\.(insert|update|delete|upsert)\(/);
    expect(spec).toContain("name: 'Cancel', exact: true");
  });

  it('record cancellation compares the complete persisted row before and after a navigation/reload', () => {
    const spec = source(recordPath);
    expect(spec).toContain("from '../support/records-fixtures'");
    expect(spec).toContain('createRecordUI(page, records, category)');
    expect(spec).toContain('await saveRecord(page, records, subject.id, { data: { quantity: 0 } })');
    expect(spec).toContain("getByRole('alertdialog', { name: 'Delete Record', exact: true })");
    expect(spec.match(/expect\(await records\.read\('records', subject\.id\)\)\.toEqual\(before\)/g)).toHaveLength(2);
    expect(spec).toContain('await recordsList(page)');
    expect(spec).toContain('await reloadRecord(page, subject.title)');
    const toolbar = source('app/records/[id]/components/RecordToolbar.tsx');
    expect(toolbar).toContain('aria-label="Delete record"');
    expect(toolbar).toContain('<AlertDialogTitle>Delete Record</AlertDialogTitle>');
    expect(toolbar).toContain('<AlertDialogCancel>Cancel</AlertDialogCancel>');
    expect(toolbar).toMatch(/<AlertDialogAction[\s\S]*?onClick=\{onDelete\}/);
  });

  it('POS cancellation checks fresh basket, exact draft absence, reset controls and persistent customer UUID', () => {
    const spec = source(customerPath);
    expect(spec).toContain('await crossflowFixture(page)');
    expect(spec).toContain("expect(initial?.cart, 'Never overwrite an existing basket').toEqual([])");
    expect(spec).toContain('expect(initial?.leadValue).toBeNull()');
    expect(spec).toContain(".eq('site_id', fixture.siteId).eq('name', draftName)");
    for (const result of ['absent', 'stillAbsent']) {
      expect(spec).toContain(`expect(${result}.error).toBeNull()`);
      expect(spec).toContain(`expect(${result}.data).toEqual([])`);
    }
    expect(spec.match(/await assertSelectedCustomer\(page, fixture\)/g)).toHaveLength(3);
    expect(spec).toContain("toHaveAttribute('data-state', 'active')");
    expect(spec).toContain("getByPlaceholder('Name', { exact: true })).toHaveValue('')");
    expect(spec).toContain("getByPlaceholder('Email', { exact: true })).toHaveValue('')");
    expect(spec).toContain('await openExactLead(page, fixture)');
    expect(spec).toContain('await page.reload(');
    const picker = source('app/pos/components/PosCustomerPickerDialog.tsx');
    expect(picker).toMatch(/onClick=\{\(\) => onOpenChange\(false\)\}[\s\S]*?label\("common.cancel", "Cancel"\)/);
    expect(picker).toContain('setName("")');
    expect(picker).toContain('setEmail("")');
    expect(picker).toContain('onClick={() => void handleCreate()}');
    const helper = source('tests/support/subsystem-crossflows.ts');
    expect(helper).toContain("db.transaction('cartSessions', 'readonly')");
    expect(helper).toContain("mode: 'existing', id: fixture.lead.id, label: fixture.lead.name");
  });
});