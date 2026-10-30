import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import SettingsPage from '@/app/settings/page';
import { getSettingsTabs, resolveSettingsSegment } from '@/app/settings/settings-navigation';
import { useSettingsQuickNav } from '@/app/settings/use-settings-quick-nav';
import type { ReactNode } from 'react';
import type { TabItem } from '@/app/components/ui/responsive-tabs-list';

const mockTranslate = (key: string) => key === 'procurement.workflow.tender.tenders' ? 'Tenders' : key;
const mockRefreshSites = jest.fn().mockResolvedValue(undefined);
const mockSite = { id: 'site-1', name: 'Test site' };
let mockCurrentSite: typeof mockSite | null = mockSite;
let mockLoading = false;

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: mockTranslate }) }));
jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: mockCurrentSite, isLoading: mockLoading, refreshSites: mockRefreshSites }),
}));
jest.mock('@/app/hooks/use-prevent-refresh', () => ({ useSimpleRefreshPrevention: jest.fn() }));
jest.mock('@/app/components/settings/data-adapter', () => ({ adaptSiteToForm: (site: unknown) => site }));
jest.mock('@/app/components/settings/save-handlers', () => ({}));
jest.mock('@/app/components/settings/site-form', () => ({
  SiteForm: ({ activeSegment }: { activeSegment: string }) => <div data-testid="site-form">{activeSegment}</div>,
}));
jest.mock('@/app/purchases/procurement/components/procurement-page', () => ({
  ProcurementPage: ({ screen: value, embedded }: { screen: string; embedded?: boolean }) => <div data-testid="procurement-page" data-embedded={embedded}>{value}</div>,
}));
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }));
jest.mock('@/app/components/ui/quick-nav', () => ({ QuickNav: () => <aside data-testid="quick-nav" /> }));
jest.mock('@/app/components/ui/responsive-tabs-list', () => ({
  ResponsiveTabsList: ({ tabs, activeTab, onTabChange }: { tabs: TabItem[]; activeTab: string; onTabChange: (tab: string) => void }) => (
    <nav>{tabs.map(tab => <button key={tab.value} aria-pressed={activeTab === tab.value} onClick={() => onTabChange(tab.value)}>{tab.label}</button>)}</nav>
  ),
}));

function setQuery(query: string) {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>);
}

beforeEach(() => {
  mockCurrentSite = mockSite;
  mockLoading = false;
  setQuery('');
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Settings navigation', () => {
  it('uses the existing localized Tenders label and preserves existing tab order', () => {
    const tabs = getSettingsTabs(mockTranslate);
    expect(tabs.find(tab => tab.value === 'tenders')?.label).toBe('Tenders');
    expect(tabs.filter(tab => tab.value !== 'tenders').map(tab => tab.value)).toEqual([
      'general', 'company', 'marketplace', 'visits', 'channels', 'team', 'calendar', 'secrets', 'printers', 'social',
    ]);
  });

  it.each(['tenders', 'procurement'])('renders procurement settings for ?tab=%s', tab => {
    setQuery(`tab=${tab}`);
    render(<SettingsPage />);
    expect(screen.getByTestId('procurement-page')).toHaveTextContent('settings');
    expect(screen.getByTestId('procurement-page')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: 'Tenders' }));
    expect(screen.getByRole('button', { name: 'Tenders' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('site-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-nav')).not.toBeInTheDocument();
  });

  it('switches to Tenders and back without resetting manual selections', () => {
    const { rerender } = render(<SettingsPage />);
    expect(screen.getByTestId('site-form')).toHaveTextContent('general');
    fireEvent.click(screen.getByRole('button', { name: 'Tenders' }));
    rerender(<SettingsPage />);
    expect(screen.getByTestId('procurement-page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'settings.tabs.company' }));
    expect(screen.getByTestId('site-form')).toHaveTextContent('company');
    expect(screen.getByTestId('quick-nav')).toBeInTheDocument();
  });

  it('responds to query changes and retains the selected tab for invalid queries', () => {
    const { rerender } = render(<SettingsPage />);
    setQuery('tab=procurement');
    rerender(<SettingsPage />);
    expect(screen.getByTestId('procurement-page')).toBeInTheDocument();
    setQuery('tab=invalid');
    rerender(<SettingsPage />);
    expect(screen.getByTestId('procurement-page')).toBeInTheDocument();
    setQuery('segment=channels');
    rerender(<SettingsPage />);
    expect(screen.getByTestId('site-form')).toHaveTextContent('channels');
  });

  it('keeps the legacy activities segment without the Settings tab bar', () => {
    setQuery('segment=activities');
    render(<SettingsPage />);
    expect(screen.getByTestId('site-form')).toHaveTextContent('activities');
    expect(screen.queryByRole('button', { name: 'Tenders' })).not.toBeInTheDocument();
  });

  it('also hides the Settings tab bar while legacy activities are loading', () => {
    mockLoading = true;
    setQuery('segment=activities');
    const { container } = render(<SettingsPage />);
    expect(container.querySelector('[data-settings-skeleton="activities"]')).not.toBeNull();
    expect(screen.queryByTestId('settings-tabs')).not.toBeInTheDocument();
  });

  it('shows the Tenders tab during loading without mounting its screen', () => {
    mockLoading = true;
    setQuery('tab=tenders');
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: 'Tenders' })).toBeInTheDocument();
    expect(screen.queryByTestId('procurement-page')).not.toBeInTheDocument();
  });

  it('preserves the no-site state', () => {
    mockCurrentSite = null;
    setQuery('tab=tenders');
    render(<SettingsPage />);
    expect(screen.getByText('settings.empty.noSite')).toBeInTheDocument();
    expect(screen.queryByTestId('procurement-page')).not.toBeInTheDocument();
  });

  it.each(['general', 'company', 'channels', 'team', 'activities', 'social', 'calendar', 'secrets', 'marketplace', 'visits', 'printers', 'tenders'])('accepts the %s segment', segment => {
    expect(resolveSettingsSegment(segment)).toBe(segment);
  });

  it('rejects missing and unknown segments', () => {
    expect(resolveSettingsSegment(null)).toBeNull();
    expect(resolveSettingsSegment('unknown')).toBeNull();
  });

  it('preserves company event children across locale changes and cleans up listeners', () => {
    const { result, rerender, unmount } = renderHook(({ t }) => useSettingsQuickNav(t), {
      initialProps: { t: mockTranslate },
    });
    const children = [{ id: 'office-1', title: 'Main office' }];
    act(() => window.dispatchEvent(new CustomEvent('officeLocationsUpdated', { detail: children })));
    expect(result.current('company').find(section => section.id === 'office-locations')?.children).toEqual(children);
    rerender({ t: key => `localized:${key}` });
    const office = result.current('company').find(section => section.id === 'office-locations');
    expect(office?.title).toBe('localized:settings.nav.officeLocations');
    expect(office?.children).toEqual(children);
    const removeListener = jest.spyOn(window, 'removeEventListener');
    unmount();
    expect(removeListener).toHaveBeenCalledWith('officeLocationsUpdated', expect.any(Function));
  });
});
