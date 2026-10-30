import { render, screen } from '@testing-library/react';
import RulesLoading from '@/app/purchases/rules/loading';
import MinimumsLoading from '@/app/inventory/minimums/loading';
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules';

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }));
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }));

test.each([['rules', <RulesLoading key="rules" />], ['minimums', <MinimumsLoading key="minimums" />]])('%s route skeleton matches the form/index layout and avoids real controls', (_name, component) => {
  const view = render(component);
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true');
  expect(view.container.querySelector('[data-rule-index-skeleton]')).toHaveClass('hidden', 'xl:block', 'w-[240px]');
  expect(view.container.querySelector('[class*="max-w-[1200px]"]')).toBeInTheDocument();
  expect(view.container.querySelector('[data-toolbar-font]')).toHaveClass('sticky');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('minimums data loading reserves both rules and cases without a nested card or false empty state', () => {
  jest.mocked(fetch).mockReturnValue(new Promise(() => {}));
  const view = render(<ReplenishmentRules siteId="site" />);
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true');
  expect(view.container.querySelectorAll('[data-rule-rows-skeleton]')).toHaveLength(2);
  for (const rows of view.container.querySelectorAll('[data-rule-rows-skeleton]')) expect(rows).not.toHaveClass('bg-background', 'rounded-xl');
  expect(screen.queryByText('No replenishment rules')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});