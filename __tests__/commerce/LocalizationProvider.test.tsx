import React from 'react';
import { render, act } from '@testing-library/react';
import { LocalizationProvider, useLocalization } from '../../app/context/LocalizationContext';

function TestComponent() {
  const { locale, isReady, t } = useLocalization();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="ready">{isReady ? 'ready' : 'loading'}</span>
      <span data-testid="translated">{t('checkout.success.title')}</span>
    </div>
  );
}

describe('LocalizationProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    // Clear cookie too if needed
    document.cookie = 'makinari-locale=; Max-Age=0; path=/';
  });

  it('renders without throwing when stored locale is missing a loader', async () => {
    localStorage.setItem('makinari-locale', 'es');

    const { getByTestId } = render(
      <LocalizationProvider>
        <TestComponent />
      </LocalizationProvider>
    );

    // It should immediately render as ready but with locale 'es'
    expect(getByTestId('locale').textContent).toBe('es');
    
    // Allow any pending microtasks to complete (like loadLocaleMessages)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(getByTestId('ready').textContent).toBe('ready');
    expect(getByTestId('translated').textContent).toBe('Order Confirmed');
  });

  it('renders without throwing for en locale', async () => {
    localStorage.setItem('makinari-locale', 'en');

    const { getByTestId } = render(
      <LocalizationProvider>
        <TestComponent />
      </LocalizationProvider>
    );

    expect(getByTestId('locale').textContent).toBe('en');
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(getByTestId('ready').textContent).toBe('ready');
  });
});
