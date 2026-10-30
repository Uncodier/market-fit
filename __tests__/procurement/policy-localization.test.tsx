import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocalizationProvider, useLocalization, type SupportedLocale } from '@/app/context/LocalizationContext';
import { rawLocaleMessages } from '@/app/context/locale-catalog';
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions';
import { ProcurementPage } from '@/app/purchases/procurement/components/procurement-page';
import { defaultPolicyDocument, procurementRuleSchema, type PolicyDocument } from '@/app/purchases/procurement/domain';
import { newStage } from '@/app/purchases/procurement/components/stage-editor';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { simulationText } from '@/app/purchases/procurement/components/policy-presentation';

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }));
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: '11111111-1111-4111-8111-111111111111', name: 'Buyer-authored workspace' } }) }));

const locales: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja'];
const copy = (locale: SupportedLocale, key: string) => rawLocaleMessages[locale][`procurement.policy.${key}`];
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const fetchMock = jest.fn();
function LocaleControls() {
  const { setLocale } = useLocalization();
  return <>{locales.map(locale => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}</>;
}
function Harness({ screen: target = 'settings' }: { screen?: 'settings' | 'rules' }) {
  return <LocalizationProvider preferredLocale="en" preferenceScope="policy-localization-test">
    <LocaleControls /><TopBarPrimaryActionsSlot /><ProcurementPage screen={target} />
  </LocalizationProvider>;
}
async function settleChoices() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 260)); }); }
beforeAll(() => {
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.defineProperty(global.crypto, 'randomUUID', { value: () => '22222222-2222-4222-8222-222222222222', configurable: true });
});
beforeEach(() => {
  localStorage.clear();
  document.cookie = 'market_fit_demo_site_id=; Max-Age=0; path=/';
  fetchMock.mockReset();
  global.fetch = fetchMock;
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.includes('/tenders/portal?')) return response({ enabled: false, slug: null });
    if (url.includes('/references?')) return response({ options: [], has_more: false });
    if (options?.method === 'PUT') return response({}, 403);
    return response({ document: defaultPolicyDocument(), revision: 5 });
  });
});

test('all five registered policy catalogs have own-language parity and interpolation parity without fallback', () => {
  const keys = Object.keys(rawLocaleMessages.en).filter(key => key.startsWith('procurement.policy.')).sort();
  expect(keys.length).toBeGreaterThan(250);
  for (const locale of locales) {
    expect(Object.keys(rawLocaleMessages[locale]).filter(key => key.startsWith('procurement.policy.')).sort()).toEqual(keys);
    for (const key of keys) {
      const text = rawLocaleMessages[locale][key];
      expect(text.trim()).not.toBe('');
      expect((text.match(/\{\{\w+\}\}/g) ?? []).sort()).toEqual((rawLocaleMessages.en[key].match(/\{\{\w+\}\}/g) ?? []).sort());
    }
    if (locale !== 'en') {
      const translated = keys.filter(key => rawLocaleMessages[locale][key] !== rawLocaleMessages.en[key]);
      expect(translated.length / keys.length).toBeGreaterThan(0.96);
    }
  }
});

test('locale switches re-render settings, stored validation, API rejection and stale simulation without fetches or draft reset', async () => {
  render(<Harness />);
  await screen.findByLabelText(copy('en', 'settings.timeZone'));
  fireEvent.change(screen.getByLabelText(copy('en', 'settings.timeZone')), { target: { value: 'Not/AZone' } });
  fireEvent.click(screen.getAllByRole('button', { name: copy('en', 'page.save') })[0]);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(copy('en', 'validation.timeZone')));
  await settleChoices();
  const reads = fetchMock.mock.calls.length;
  for (const locale of locales.slice(1)) {
    fireEvent.click(screen.getByText(locale, { exact: true }));
    expect(screen.getByRole('heading', { name: copy(locale, 'page.settings') })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'validation.timeZone'));
    expect(screen.getByLabelText(copy(locale, 'settings.timeZone'))).toHaveValue('Not/AZone');
    expect(screen.queryByText(/procurement\.policy\./)).not.toBeInTheDocument();
  }
  await settleChoices();
  expect(fetchMock).toHaveBeenCalledTimes(reads);
  fireEvent.change(screen.getByLabelText(copy('ja', 'settings.timeZone')), { target: { value: 'Asia/Tokyo' } });
  fireEvent.click(screen.getAllByRole('button', { name: copy('ja', 'page.save') })[0]);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(copy('ja', 'feedback.permission')));
  const put = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(put![1].body).document.settings.timeZone).toBe('Asia/Tokyo');
  const afterSave = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: copy('ja', 'simulator.run') }));
  expect(screen.getByText(copy('ja', 'simulation.fallbackBlock'))).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(copy('ja', 'simulator.currency')), { target: { value: 'USD' } });
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }));
    expect(screen.getByText(copy(locale, 'simulator.stale'))).toBeInTheDocument();
    expect(screen.getByText(copy(locale, 'simulation.fallbackBlock'))).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'feedback.permission'));
    expect(screen.getByLabelText(copy(locale, 'simulator.currency'))).toHaveValue('USD');
    expect(screen.getByLabelText(copy(locale, 'settings.timeZone'))).toHaveValue('Asia/Tokyo');
  }
  await settleChoices();
  expect(fetchMock).toHaveBeenCalledTimes(afterSave);
});

test('rules and nested editors preserve authored names and canonical enums across all locales', async () => {
  const document: PolicyDocument = defaultPolicyDocument();
  const stage = newStage();
  stage.name = 'Buyer-authored approval';
  stage.approverIds = ['eligible-person'];
  document.rules = [procurementRuleSchema.parse({ id: 'rule-1', name: 'Buyer-authored rule', type: 'approval', event: 'requisition', stages: [stage],
    amount: { operator: 'gte', valueMinor: 1234, currency: 'JPY', basis: 'document' },
    requirements: [{ id: 'requirement-1', name: 'Buyer-authored standard', kind: 'technical', classification: 'mandatory', milestone: 'award', overridable: false }],
  })];
  fetchMock.mockImplementation(async (url: string) => url.includes('/references?') ? response({ options: [], has_more: false }) : response({ document, revision: 4 }));
  render(<Harness screen="rules" />);
  await screen.findByRole('button', { name: 'Edit Buyer-authored rule' });
  expect(screen.getByText(/1,234/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Buyer-authored rule' }));
  await screen.findByLabelText(copy('en', 'rule.name'));
  await settleChoices();
  const reads = fetchMock.mock.calls.length;
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }));
    expect(screen.getByLabelText(copy(locale, 'rule.name'))).toHaveValue('Buyer-authored rule');
    expect(screen.getByLabelText(copy(locale, 'stage.name'))).toHaveValue('Buyer-authored approval');
    expect(screen.getByLabelText(copy(locale, 'requirement.name'))).toHaveValue('Buyer-authored standard');
    expect(screen.getByLabelText(copy(locale, 'rule.status'))).toHaveTextContent(rawLocaleMessages[locale]['procurement.values.draft']);
    expect(screen.getByLabelText(copy(locale, 'stage.decisionMode'))).toHaveTextContent(rawLocaleMessages[locale]['procurement.values.human']);
  }
  await settleChoices();
  expect(fetchMock).toHaveBeenCalledTimes(reads);
});

test('every dynamic simulator diagnostic translates without changing authored names or canonical output', () => {
  const diagnostics = [
    'Business calendar calendar-id must be resolved by an authorized calendar service.', 'Missing deadline anchor: stage_activation.',
    'Buyer-name: missing requester.', 'Buyer-name: missing responsible person.', 'Buyer-name: line inputs are required to evaluate scope.',
    'Buyer-name: product/category classification is missing for a required scope.', 'Buyer-name: no authorized dated FX conversion from USD to MXN.',
    'Buyer-name: compared 1234 MXN net minor units (matching_lines).', 'Buyer-name: requester is required to evaluate self-approval restrictions.',
    'Buyer-name: self-approval restrictions make the configured quorum impossible.', 'Buyer-name: deadline reached; timeout action is remind, never approval.',
    'Buyer-name: AI decision is not executed by this simulator.', 'Buyer-name: AI recommendation is not executed by this simulator.',
    'Conflicting requirement requirement-id; no rule may overwrite another requirement.', 'No rules matched; using general fallback (block).',
    'lines: Line net amounts must equal the document net total', 'rules.0.stages.0.approverIds: A human stage requires eligible approvers',
    'netAmountMinor: Expected number, received nan', 'lines: Array must contain at most 1000 element(s)',
  ];
  function Diagnostics() {
    const i18n = useProcurementI18n();
    return <ul>{diagnostics.map(raw => <li key={raw}>{simulationText(raw, i18n)}</li>)}</ul>;
  }
  render(<LocalizationProvider preferredLocale="en" preferenceScope="policy-diagnostics-test"><LocaleControls /><Diagnostics /></LocalizationProvider>);
  for (const locale of locales.slice(1)) {
    fireEvent.click(screen.getByText(locale, { exact: true }));
    const items = screen.getAllByRole('listitem').map(item => item.textContent!);
    expect(items).toHaveLength(diagnostics.length);
    expect(items.join(' ')).not.toMatch(/procurement\.|Could not complete|missing requester|self-approval restrictions|Expected number|Array must/);
    diagnostics.forEach((raw, index) => { expect(items[index]).not.toBe(raw); if (raw.startsWith('Buyer-name')) expect(items[index]).toContain('Buyer-name'); });
    expect(items[0]).toContain('calendar-id');
    expect(items[6]).toContain('USD');
    expect(items[6]).toContain('MXN');
  }
});