import { fireEvent, render, screen } from '@testing-library/react';
import NavigationPage from '@/app/navigation/page';
import { navigateOrAssign } from '@/lib/navigation/stale-router';

jest.mock('@/lib/navigation/stale-router', () => ({ navigateOrAssign: jest.fn() }));
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => ({
  'procurement.policy.page.minimums': 'Inventory minimums',
  'layout.category.operations': 'Operations',
}[key] ?? key) }) }));
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => ({ canAccessNavKey: () => true }) }));
jest.mock('@/app/components/navigation/use-sidebar-nav-keys', () => ({ useSidebarNavKeys: () => new Set() }));
jest.mock('@/app/components/navigation/ModuleImage', () => ({ ModuleImage: () => null }));

beforeEach(() => jest.mocked(navigateOrAssign).mockClear());

test.each([false, true])('navigation launcher shows inventory minimums in Operations and opens its route (overlay=%s)', isOverlay => {
  const onClose = jest.fn();
  render(<NavigationPage isOverlay={isOverlay} onClose={onClose} />);
  const tile = screen.getByRole('button', { name: 'Inventory minimums' });
  expect(tile).toHaveAttribute('id', 'tour-app-inventoryMinimums');
  const operations = screen.getByRole('heading', { name: 'Operations' }).parentElement!.parentElement!;
  expect(operations).toContainElement(tile);
  fireEvent.click(tile);
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), '/inventory/minimums');
  expect(onClose).toHaveBeenCalledTimes(1);
});