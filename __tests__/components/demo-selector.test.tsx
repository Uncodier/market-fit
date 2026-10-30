import { render, screen } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import DemoSelectorPage from '@/app/demo/page';

jest.mock('@/lib/demo-data', () => ({
  availableDemos: [
    { id: 'demo-one', name: 'First demo', description: 'First account' },
    { id: 'demo-two', name: 'Second demo', description: 'Second account' },
  ],
}));

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

describe('Demo selector actions', () => {
  beforeEach(() => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    document.cookie = 'market_fit_demo_site_id=; path=/; max-age=0';
  });

  afterEach(() => {
    document.cookie = 'market_fit_demo_site_id=; path=/; max-age=0';
  });

  it('offers re-entry for the current account with a separate selection indicator', () => {
    document.cookie = 'market_fit_demo_site_id=demo-one; path=/';

    render(<DemoSelectorPage />);

    const reenter = screen.getByRole('button', { name: 'public.demo.reenter' });
    expect(reenter).toHaveClass('bg-secondary');
    expect(reenter).not.toHaveClass('bg-primary');
    expect(screen.queryByRole('button', { name: 'public.demo.selected' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'public.demo.load' })).toHaveLength(1);

    const indicator = screen.getByText('public.demo.current');
    expect(indicator.closest('button')).toBeNull();
    expect(indicator.querySelector('svg')).toBeInTheDocument();
    expect(indicator.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(indicator).toHaveClass('text-emerald-700');
    expect(reenter.closest('.ring-primary')).not.toBeNull();
  });

  it('offers loading for every account when no demo is selected', () => {
    render(<DemoSelectorPage />);

    expect(screen.getAllByRole('button', { name: 'public.demo.load' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'public.demo.reenter' })).not.toBeInTheDocument();
    expect(screen.queryByText('public.demo.current')).not.toBeInTheDocument();
  });
});