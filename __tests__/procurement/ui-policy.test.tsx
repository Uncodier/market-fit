import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import React from 'react';
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
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } });

beforeEach(() => {
  render(<TopBarPrimaryActionsSlot />)

  fetchMock.mockReset();
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
  expect(within(window.document.getElementById('page-primary-actions')!).getByRole('button', { name: 'Save policy' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'America/Mexico_City' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await screen.findByText(/Policy saved as revision 8/);
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toContain(mockSite!.id);
  expect(options.method).toBe('PUT');
  const body = JSON.parse(options.body);
  expect(body.expected_revision).toBe(7);
  expect(body.document.rules).toEqual(document.rules);
  expect(body.document.settings.timeZone).toBe('America/Mexico_City');
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
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
  await screen.findByText(/Policy saved as revision 5/);
  const body = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body.document.settings).toEqual(document.settings);
  expect(body.document.rules[0]).toMatchObject({ name: 'Updated office policy', status: 'archived' });
});

test('rules keep Save then Create in the global bar and disable portaled creation during save', async () => {
  const policy = defaultPolicyDocument();
  policy.rules = [procurementRuleSchema.parse({ id: 'rule-1', name: 'Office policy', type: 'approval', event: 'requisition' })];
  const saving = pending<Response>();
  fetchMock.mockResolvedValueOnce(snapshot(policy, 4)).mockReturnValueOnce(saving.promise);
  render(<ProcurementPage screen="rules" />);
  await screen.findByRole('button', { name: 'Archive Office policy' });
  const topbar = within(document.getElementById('page-primary-actions')!);
  expect(topbar.getAllByRole('button').map(button => button.textContent)).toEqual(['Save policy', 'Create rule']);
  expect(screen.getAllByRole('button', { name: 'Create rule' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Archive Office policy' }));
  fireEvent.click(topbar.getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(topbar.getByRole('button', { name: 'Create rule' })).toBeDisabled());
  expect(topbar.getByRole('button', { name: 'Saving policy…' })).toBeDisabled();
  await act(async () => { saving.resolve(snapshot({ ...policy, rules: [{ ...policy.rules[0], status: 'archived' }] }, 5)); });
  expect(topbar.getByRole('button', { name: 'Create rule' })).toBeEnabled();
});

test('conflict retains draft, disables retry and explicitly reloads latest revision', async () => {
  const latest = defaultPolicyDocument(); latest.settings.timeZone = 'Asia/Tokyo';
  fetchMock.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(snapshot(latest, 2));
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Europe/London' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await screen.findByText(/changed in another session/);
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Europe/London');
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reload latest policy (discard draft)' }));
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
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('successful null document alone enables initial defaults and revision-zero save', async () => {
  fetchMock.mockResolvedValueOnce(snapshot(null, 0)).mockImplementationOnce(async (_url: string, options: RequestInit) => snapshot(JSON.parse(options.body as string).document, 1));
  render(<ProcurementPage screen="settings" />);
  await loaded();
  expect(screen.getByLabelText('Fallback behavior')).toHaveTextContent('Block');
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await screen.findByText(/Policy saved as revision 1/);
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
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const saveSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
  mockSite = { id: '22222222-2222-4222-8222-222222222222', name: 'Next workspace' };
  view.rerender(<ProcurementPage screen="settings" />);
  expect(saveSignal.aborted).toBe(true);
  await loaded();
  await act(async () => { oldSave.resolve(snapshot(defaultPolicyDocument(), 2)); });
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Asia/Tokyo');
  expect(screen.queryByText(/Policy saved/)).not.toBeInTheDocument();
});

test('demo site does not read or save policies', () => {
  mockSite = { id: 'demo-example', name: 'Demo' };
  render(<ProcurementPage screen="settings" />);
  expect(screen.getByText(/Demo saves are not supported/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('save rejection preserves draft and never shows success', async () => {
  fetchMock.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(response({}, 403));
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Asia/Tokyo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await screen.findByText(/Only workspace owners and administrators/);
  expect(screen.getByLabelText('Workspace time zone')).toHaveValue('Asia/Tokyo');
  expect(screen.queryByText(/Policy saved/)).not.toBeInTheDocument();
});

test('invalid structured settings never dispatch a save', async () => {
  fetchMock.mockResolvedValueOnce(snapshot());
  render(<ProcurementPage screen="settings" />);
  await loaded();
  fireEvent.change(screen.getByLabelText('Workspace time zone'), { target: { value: 'Not/AZone' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Use a valid IANA time zone');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([[null, 5], [defaultPolicyDocument(), 0]])('blocks inconsistent revision/document responses', async (document, revision) => {
  fetchMock.mockResolvedValueOnce(response({ document, revision }));
  render(<ProcurementPage screen="settings" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('saved policy response is invalid');
  expect(screen.queryByLabelText('Workspace time zone')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
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