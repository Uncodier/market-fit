jest.mock('@/app/purchases/procurement/components/portal-settings', () => ({ PortalSettings: () => null }));
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import React from 'react';
import { toast } from 'sonner';
jest.mock('sonner', () => ({ toast: { success: jest.fn(), info: jest.fn() } }));
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProcurementPage } from '@/app/purchases/procurement/components/procurement-page';
import { defaultPolicyDocument, procurementRuleSchema, type PolicyDocument } from '@/app/purchases/procurement/domain';

let mockSite: { id: string; name: string } | null = { id: '11111111-1111-4111-8111-111111111111', name: 'First workspace' };
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }));
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }));
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }));

const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const snapshot = (document: PolicyDocument | null = defaultPolicyDocument(), revision = 1) => response({ document, revision });
const fetchMock = jest.fn();
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function loaded() { await screen.findByLabelText('Workspace time zone'); }
const saveButton = () => screen.getAllByRole('button', { name: 'Save policy' })[0];
beforeAll(() => {
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.defineProperty(global.crypto, 'randomUUID', { value: () => '22222222-2222-4222-8222-222222222222', configurable: true });
});

beforeEach(() => {
  render(<TopBarPrimaryActionsSlot />)

  fetchMock.mockReset();
  jest.mocked(toast.success).mockClear();
  global.fetch = jest.fn((url, options) => String(url).includes('/references?')
    ? Promise.resolve(response({ options: [], has_more: false }))
    : fetchMock(url, options));
  mockSite = { id: '11111111-1111-4111-8111-111111111111', name: 'First workspace' };
  localStorage.clear();
  document.cookie = 'market_fit_demo_site_id=; Max-Age=0; path=/';
});

test('settings save sends complete document with CAS and preserves rules', async () => {
  const document = defaultPolicyDocument();
  document.rules = [procurementRuleSchema.parse({ id: 'saved-rule', name: 'Keep this rule', type: 'requirements', event: 'offer' })];
  fetchMock.mockResolvedValueOnce(snapshot(document, 7)).mockImplementationOnce(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    return snapshot(body.document, 8);
  });
  render(<ProcurementPage screen="settings" />);
  await loaded();
  expect(screen.getByText('Procurement rules').parentElement).toHaveClass('text-sm');
  expect(window.document.getElementById('page-primary-actions')).toBeEmptyDOMElement();
  for (const button of screen.getAllByRole('button', { name: 'Save policy' })) expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'America/Mexico_City' } });
  fireEvent.click(saveButton());
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 8')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toContain(mockSite!.id);
  expect(options.method).toBe('PUT');
  const body = JSON.parse(options.body);
  expect(body.expected_revision).toBe(7);
  expect(body.document.rules).toEqual(document.rules);
  expect(body.document.settings.timeZone).toBe('America/Mexico_City');
  for (const button of screen.getAllByRole('button', { name: 'Save policy' })) expect(button).toBeDisabled();
});

test('each Settings card owns a shared footer and all footers track the same document save', async () => {
  const saving = pending<Response>();
  fetchMock.mockResolvedValueOnce(snapshot()).mockReturnValueOnce(saving.promise);
  render(<ProcurementPage screen="settings" />);
  await loaded();
  const titles = ['General defaults', 'When no rules match', 'Deadlines', 'Supervisor exceptions', 'Urgent purchase preset', 'Rejection notifications'];
  const buttons = titles.map(title => {
    const heading = screen.getByRole('heading', { name: title, level: 3 });
    const card = heading.parentElement!.parentElement!.parentElement!;
    const footer = card.lastElementChild as HTMLElement;
    expect(footer).toHaveClass('border-t', 'bg-muted/30', 'justify-end');
    const button = within(footer).getByRole('button', { name: 'Save policy' });
    expect(button).toHaveClass('ring-input', 'px-3');
    expect(button).toBeDisabled();
    return button;
  });
  expect(screen.getAllByRole('button', { name: 'Save policy' })).toHaveLength(titles.length);
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Asia/Tokyo' } });
  for (const button of buttons) expect(button).toBeEnabled();
  fireEvent.click(buttons[buttons.length - 1]);
  for (const button of buttons) expect(button).toBeDisabled();
  expect(screen.getAllByRole('button', { name: 'Saving policy…' })).toHaveLength(titles.length);
  const document = defaultPolicyDocument(); document.settings.timeZone = 'Asia/Tokyo';
  await act(async () => { saving.resolve(snapshot(document, 2)); });
  for (const button of buttons) expect(button).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(window.document.getElementById('page-primary-actions')).toBeEmptyDOMElement();
});

test('an initial policy can still be saved from its card footer before edits', async () => {
  fetchMock.mockResolvedValueOnce(snapshot(null, 0)).mockImplementationOnce(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    return snapshot(body.document, 1);
  });
  render(<ProcurementPage screen="settings" />);
  await loaded();
  expect(saveButton()).toBeEnabled();
  fireEvent.click(saveButton());
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 1')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).expected_revision).toBe(0);
  for (const button of screen.getAllByRole('button', { name: 'Save policy' })) expect(button).toBeDisabled();
});

test('rules edit and archive preserve general settings in full-document save', async () => {
  const document = defaultPolicyDocument();
  document.settings.timeZone = 'Europe/London';
  document.rules = [procurementRuleSchema.parse({ id: 'rule-1', name: 'Office policy', type: 'approval', event: 'requisition' })];
  fetchMock.mockResolvedValueOnce(snapshot(document, 4)).mockImplementationOnce(async (_url: string, options: RequestInit) => snapshot(JSON.parse(options.body as string).document, 5));
  render(<ProcurementPage screen="rules" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Office policy' }));
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Updated office policy' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Archive Updated office policy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 5')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  const body = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body.document.settings).toEqual(document.settings);
  expect(body.document.rules[0]).toMatchObject({ name: 'Updated office policy', status: 'archived' });
});

test('card header creation opens an inline Skills-style editor and only its footer persists the draft', async () => {
  fetchMock.mockResolvedValueOnce(snapshot()).mockImplementationOnce(async (_url: string, options: RequestInit) => {
    return snapshot(JSON.parse(options.body as string).document, 2);
  });
  render(<ProcurementPage screen="rules" />);
  const create = await screen.findByRole('button', { name: 'Create rule' });
  fireEvent.click(create);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const editor = document.getElementById('procurement-rule-22222222-2222-4222-8222-222222222222')!;
  expect(editor).toHaveClass('rounded-xl', 'border-border/70', 'bg-card');
  expect(editor.lastElementChild).toHaveClass('border-t', 'bg-muted/30', 'px-5', 'py-3');
  expect(within(editor).getByRole('button', { name: 'Save policy' })).toBeEnabled();
  expect(screen.getByLabelText('Rule name')).toHaveValue('New rule');
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Purchasing requirement' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(saveButton());
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 2')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).document.rules[0]).toMatchObject({ name: 'Purchasing requirement', status: 'draft' });
  expect(document.getElementById('page-primary-actions')).toContainElement(create);
});

test('search and creation are outside rule cards and each card expands independently', async () => {
  const document = defaultPolicyDocument();
  document.rules = ['First rule', 'Second rule'].map((name, i) => procurementRuleSchema.parse({ id: 'rule-' + i, name, type: 'approval', event: 'requisition' }));
  fetchMock.mockResolvedValueOnce(snapshot(document));
  const view = render(<ProcurementPage screen="rules" />);
  const create = await screen.findByRole('button', { name: 'Create rule' });
  expect(window.document.getElementById('page-primary-actions')).toContainElement(create);
  expect(view.container).not.toContainElement(create);
  expect(view.container.querySelector('[data-policy-toolbar]')).toContainElement(screen.getByRole('textbox', { name: 'Search rules' }));
  expect(screen.getAllByRole('button', { name: 'Create rule' })).toHaveLength(1);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit First rule' }));
  expect(screen.getByRole('button', { name: 'Edit First rule' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Edit Second rule' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByLabelText('Rule name')).toHaveValue('First rule');
});

test('inline creation matches Skills sizing and saves directly from the editor footer', async () => {
  const saving = pending<Response>();
  fetchMock.mockResolvedValueOnce(snapshot()).mockReturnValueOnce(saving.promise);
  render(<ProcurementPage screen="rules" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create rule' }));
  const editor = document.getElementById('procurement-rule-22222222-2222-4222-8222-222222222222')!;
  expect(editor.closest('[class*="max-w-"]')).toHaveClass('max-w-[880px]', 'px-4', 'md:px-16');
  const conditions = screen.getByText('Conditions', { selector: 'legend' }).parentElement!;
  expect(conditions).toHaveClass('rounded-lg', 'border-black/5', 'dark:border-white/5', 'bg-muted/30', 'p-4');
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Inline purchasing rule' } });
  fireEvent.click(within(editor).getByRole('button', { name: 'Save policy' }));
  expect(within(editor).getByRole('button', { name: 'Saving policy…' })).toBeDisabled();
  expect(within(editor).getByRole('button', { name: 'Done editing' })).toBeDisabled();
  const body = JSON.parse(fetchMock.mock.calls[1][1].body);
  await act(async () => { saving.resolve(snapshot(body.document, 2)); });
  expect(screen.getByLabelText('Rule name')).toHaveValue('Inline purchasing rule');
  expect(within(editor).getByRole('button', { name: 'Save policy' })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('Settings index navigates to real cards and the sticky toolbar has no form margins', async () => {
  fetchMock.mockResolvedValueOnce(snapshot());
  const view = render(<ProcurementPage screen="settings" />);
  await loaded();
  const toolbar = view.container.querySelector('[data-policy-toolbar]')!;
  expect(toolbar).toHaveClass('w-full');
  expect(toolbar).not.toHaveClass('mx-auto', 'max-w-[880px]', 'px-4', 'md:px-16');
  const nav = screen.getByRole('navigation');
  const target = document.getElementById('procurement-settings-deadlines')!;
  target.scrollIntoView = jest.fn();
  fireEvent.click(within(nav).getByRole('button', { name: 'Deadlines' }));
  expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(nav.parentElement!.parentElement!.parentElement).toHaveClass('hidden', 'xl:block', 'w-[240px]');
});

test('index includes each rule and simulator actions live in its footer', async () => {
  fetchMock.mockResolvedValueOnce(snapshot());
  render(<ProcurementPage screen="rules" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create rule' }));
  const card = document.getElementById('procurement-rule-22222222-2222-4222-8222-222222222222')!;
  card.scrollIntoView = jest.fn();
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /New rule/ }));
  expect(card.scrollIntoView).toHaveBeenCalled();
  const simulator = document.getElementById('procurement-simulator')!;
  expect(simulator.lastElementChild).toHaveClass('border-t', 'bg-muted/30');
  expect(simulator.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Run simulation' }));
});

test('saving one expanded rule leaves sibling edits unsaved and uses the new revision on the next save', async () => {
  const document = defaultPolicyDocument();
  document.rules = ['a', 'b'].map(id => procurementRuleSchema.parse({ id, name: id, type: 'approval', event: 'requisition' }));
  fetchMock.mockResolvedValueOnce(snapshot(document, 5)).mockImplementation(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    return snapshot(body.document, body.expected_revision + 1);
  });
  render(<ProcurementPage screen="rules" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit a' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit b' }));
  const a = documentElement('procurement-rule-a'), b = documentElement('procurement-rule-b');
  fireEvent.change(within(a).getByLabelText('Rule name'), { target: { value: 'Edited a' } });
  fireEvent.change(within(b).getByLabelText('Rule name'), { target: { value: 'Edited b' } });
  fireEvent.click(within(a).getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 6')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).document.rules.map((rule: { name: string }) => rule.name)).toEqual(['Edited a', 'b']);
  expect(within(b).getByLabelText('Rule name')).toHaveValue('Edited b');
  expect(within(b).getByRole('button', { name: 'Save policy' })).toBeEnabled();
  expect(within(a).getByRole('button', { name: 'Save policy' })).toBeDisabled();
  fireEvent.click(within(b).getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 7')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).expected_revision).toBe(6);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).document.rules.map((rule: { name: string }) => rule.name)).toEqual(['Edited a', 'Edited b']);
});

function documentElement(id: string) { return window.document.getElementById(id)!; }

test('purchase segments filter rule states beside the default sticky search', async () => {
  const document = defaultPolicyDocument();
  document.rules = ['draft', 'active', 'archived'].map(status => procurementRuleSchema.parse({ id: status, name: status, status, type: 'supplier_participation', event: 'requisition', minimumSupplierProposals: 1 }));
  fetchMock.mockResolvedValue(snapshot(document));
  const view = render(<ProcurementPage screen="rules" />);
  await screen.findByRole('button', { name: 'Edit draft' });
  expect(screen.queryByRole('tab', { name: 'Inventory minimums' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Filter by status' })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Active' }), { button: 0, ctrlKey: false });
  expect(screen.getByRole('button', { name: 'Edit active' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit draft' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit archived' })).not.toBeInTheDocument();
  expect(view.container.querySelector('[data-rule-tabs]')).toContainElement(screen.getByRole('textbox', { name: 'Search rules' }));
  expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/replenishment'))).toBe(true);
});

test('conflict retains draft, disables retry and explicitly reloads latest revision', async () => {
  const latest = defaultPolicyDocument(); latest.settings.timeZone = 'Asia/Tokyo';
  fetchMock.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(snapshot(latest, 2));
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Europe/London' } });
  fireEvent.click(saveButton());
  await screen.findByText(/changed in another session/);
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Europe/London');
  expect(saveButton()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft and reload' }));
  await waitFor(() => expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Asia/Tokyo'));
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test.each([401, 403, 503])('failed read %s never creates editable defaults', async (status) => {
  fetchMock.mockResolvedValue(response({}, status));
  render(<ProcurementPage screen="settings" />);
  await screen.findByRole('alert');
  expect(screen.queryByLabelText('Workspace time zone')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save policy' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('successful null document alone enables initial defaults and revision-zero save', async () => {
  fetchMock.mockResolvedValueOnce(snapshot(null, 0)).mockImplementationOnce(async (_url: string, options: RequestInit) => snapshot(JSON.parse(options.body as string).document, 1));
  render(<ProcurementPage screen="settings" />);
  await loaded();
  expect(screen.getByLabelText('Fallback behavior')).toHaveTextContent('Block');
  fireEvent.click(saveButton());
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Policy saved as revision 1')));
  expect(screen.queryByText(/Policy saved as revision/)).not.toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).expected_revision).toBe(0);
});

test('site switch aborts old read and ignores its late response', async () => {
  const oldRead = pending<Response>();
  const next = defaultPolicyDocument(); next.settings.timeZone = 'Asia/Tokyo';
  fetchMock.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce(snapshot(next, 3));
  const view = render(<ProcurementPage screen="settings" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  mockSite = { id: '22222222-2222-4222-8222-222222222222', name: 'Next workspace' };
  view.rerender(<ProcurementPage screen="settings" />);
  expect(oldSignal.aborted).toBe(true);
  await loaded();
  await act(async () => { oldRead.resolve(snapshot()); });
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Asia/Tokyo');
  expect(screen.getByText(/Next workspace/)).toBeInTheDocument();
});

test('site switch discards edits, aborts a pending save and ignores late save success', async () => {
  const oldSave = pending<Response>();
  const next = defaultPolicyDocument(); next.settings.timeZone = 'Asia/Tokyo';
  fetchMock.mockResolvedValueOnce(snapshot()).mockReturnValueOnce(oldSave.promise).mockResolvedValueOnce(snapshot(next, 12));
  const view = render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Europe/London' } });
  fireEvent.click(saveButton());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const saveSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
  mockSite = { id: '22222222-2222-4222-8222-222222222222', name: 'Next workspace' };
  view.rerender(<ProcurementPage screen="settings" />);
  expect(saveSignal.aborted).toBe(true);
  await loaded();
  await act(async () => { oldSave.resolve(snapshot(defaultPolicyDocument(), 2)); });
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Asia/Tokyo');
  expect(screen.queryByText(/Policy saved/)).not.toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
});

test('demo site renders local policy without reading or saving', async () => {
  mockSite = { id: 'demo-example', name: 'Demo' };
  render(<ProcurementPage screen="settings" />);
  expect(await screen.findByLabelText('Workspace time zone')).toHaveValue('America/Chicago');
  expect(screen.getByLabelText('Workspace time zone')).toBeDisabled();
  expect(toast.info).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Procurement demo')).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('save rejection preserves draft and never shows success', async () => {
  fetchMock.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(response({}, 403));
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Asia/Tokyo' } });
  fireEvent.click(saveButton());
  await screen.findByText(/Only workspace owners and administrators/);
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Asia/Tokyo');
  expect(screen.queryByText(/Policy saved/)).not.toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
});

test('invalid structured settings never dispatch a save', async () => {
  fetchMock.mockResolvedValueOnce(snapshot());
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Not/AZone' } });
  fireEvent.click(saveButton());
  expect(await screen.findByRole('alert')).toHaveTextContent('Use a valid IANA time zone');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([[null, 5], [defaultPolicyDocument(), 0]])('blocks inconsistent revision/document responses', async (document, revision) => {
  fetchMock.mockResolvedValueOnce(response({ document, revision }));
  render(<ProcurementPage screen="settings" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('saved policy response is invalid');
  expect(screen.queryByLabelText('Workspace time zone')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save policy' })).not.toBeInTheDocument();
});

test('simulation is explicit, blocked safely and marks outdated results', async () => {
  fetchMock.mockResolvedValue(snapshot());
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
  expect(screen.getByText('Simulation only: Blocked / missing inputs')).toBeInTheDocument();
  expect(screen.getByText(/effective fallback blocks progression/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Asia/Tokyo' } });
  expect(screen.getByText(/result below is stale/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});