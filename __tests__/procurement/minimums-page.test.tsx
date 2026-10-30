import { fireEvent, render, screen, within } from '@testing-library/react';
import MinimumsPage from '@/app/inventory/minimums/page';
import { NAVIGATION_AREAS, getNavItemTitle } from '@/app/config/navigation-areas';
import { procurementRouteTitle } from '@/lib/navigation/procurement-route-title';

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: '11111111-1111-4111-8111-111111111111' } }) }));
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }));
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }));
beforeAll(() => {
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
});

test('inventory minimums is an Operations destination, separate from purchase rules', () => {
  const item = NAVIGATION_AREAS.operations.items.find(item => item.key === 'inventoryMinimums')!;
  expect(item.href).toBe('/inventory/minimums');
  expect(NAVIGATION_AREAS.buying.items.some(item => item.key === 'inventoryMinimums')).toBe(false);
  expect(getNavItemTitle(item, key => key)).toBe('Inventory minimums');
  expect(procurementRouteTitle(item.href)).toBe('Inventory minimums');
});

test('dedicated minimums screen filters enabled state and search without reading policies', async () => {
  jest.mocked(fetch).mockReset().mockResolvedValue({ ok: true, json: async () => ({
    rules: [
      { id: 'a', name: 'Paper stock', enabled: true, minimum: 1, target: 10 },
      { id: 'b', name: 'Office stock', enabled: false, minimum: 1, target: 10 },
    ], cases: [], queue: [], rule_count: 2, case_count: 0,
  }) } as Response);
  render(<MinimumsPage />);
  await screen.findByText('Paper stock');
  expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Enabled' }), { button: 0, ctrlKey: false });
  expect(screen.queryByText('Office stock')).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Disabled' }), { button: 0, ctrlKey: false });
  expect(screen.getByText('Office stock')).toBeInTheDocument();
  expect(screen.queryByText('Paper stock')).not.toBeInTheDocument();
  const toolbar = screen.getByRole('tablist').parentElement!.parentElement!;
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Search rules' }));
  fireEvent.change(within(toolbar).getByRole('textbox', { name: 'Search rules' }), { target: { value: 'missing' } });
  expect(screen.queryByText('Office stock')).not.toBeInTheDocument();
  expect(screen.getByText('On this page')).toBeInTheDocument();
  expect(jest.mocked(fetch).mock.calls.every(([url]) => String(url).includes('/replenishment?'))).toBe(true);
});