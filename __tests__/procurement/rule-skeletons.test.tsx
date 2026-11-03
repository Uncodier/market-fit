import { render, screen } from '@testing-library/react';
import RulesLoading from '@/app/purchases/rules/loading';
import MinimumsLoading from '@/app/inventory/minimums/loading';
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules';

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }));
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }));

test('rules route skeleton matches the form/index layout and avoids real controls', () => {
  const view = render(<RulesLoading />);
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true');
  expect(view.container.querySelector('[data-rule-index-skeleton]')).toHaveClass('hidden', 'xl:block', 'w-[240px]');
  expect(view.container.querySelector('[class*="max-w-[1200px]"]')).toBeInTheDocument();
  expect(view.container.querySelector('[data-toolbar-font]')).toHaveClass('sticky');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('minimums route loading matches the full-width document table', () => {
  const view = render(<MinimumsLoading />);
  expect(view.container.querySelector('table')).toHaveClass('min-w-[1000px]');
  expect(view.container.querySelectorAll('th')).toHaveLength(6);
  expect(view.container.querySelector('[data-rule-index-skeleton]')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('minimums data loading reserves rules without global cases, a nested card, or false empty state', () => {
  jest.mocked(fetch).mockReturnValue(new Promise(() => {}));
  const view = render(<ReplenishmentRules siteId="site" />);
  expect(screen.getByRole('status', { name: 'Loading records' })).toHaveAttribute('aria-busy', 'true');
  expect(view.container.querySelectorAll('table')).toHaveLength(1);
  expect(view.container.querySelectorAll('th')).toHaveLength(6);
  expect(document.getElementById('procurement-replenishment-cases')).not.toBeInTheDocument();
  for (const rows of view.container.querySelectorAll('[data-rule-rows-skeleton]')) expect(rows).not.toHaveClass('bg-background', 'rounded-xl');
  expect(screen.queryByText('No replenishment rules')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});