import React, { useLayoutEffect } from 'react';
import { fireEvent, render, act, waitFor } from '@testing-library/react';
import { LocalizationProvider, useLocalization } from '../../app/context/LocalizationContext';

function TestComponent() {
  const { locale, isReady, t } = useLocalization();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="ready">{isReady ? 'ready' : 'loading'}</span>
      <span data-testid="translated">{t('checkout.success.title')}</span>
      <span data-testid="tickets">{t('pdp.getTickets')}</span>
      <span data-testid="admin">{t('dashboard.analytics.clientCohort.title')}</span>
    </div>
  );
}

function SiteLocaleProbe({ siteLocale }: { siteLocale?: string | null }) {
  const { locale, t, applyUnresolvedLocale, isReady } = useLocalization();
  useLayoutEffect(() => {
    if (!isReady) return;
    void applyUnresolvedLocale(siteLocale);
  }, [isReady, siteLocale, applyUnresolvedLocale]);
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t('checkout.success.title')}</span>
    </div>
  );
}

function ManualApply() {
  const { locale, t, applyUnresolvedLocale } = useLocalization();
  return (
    <div>
      <button type="button" onClick={() => { void applyUnresolvedLocale('es'); }}>
        apply-es
      </button>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t('checkout.success.title')}</span>
    </div>
  );
}

describe('LocalizationProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'makinari-locale=; Max-Age=0; path=/';
  });

  it('renders Spanish storefront strings when stored locale is es', async () => {
    localStorage.setItem('makinari-locale', 'es');

    const { getByTestId } = render(
      <LocalizationProvider>
        <TestComponent />
      </LocalizationProvider>
    );

    expect(getByTestId('locale').textContent).toBe('es');
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(getByTestId('ready').textContent).toBe('ready');
    expect(getByTestId('translated').textContent).toBe('Pedido confirmado');
    expect(getByTestId('tickets').textContent).toBe('Obtener entradas');
    expect(getByTestId('admin').textContent).toBe('Client Cohort Analysis');
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

  it('applies site locale and translations together when there is no stored preference', async () => {
    const { getByTestId } = render(
      <LocalizationProvider>
        <SiteLocaleProbe siteLocale="es" />
      </LocalizationProvider>
    );

    await waitFor(() => {
      expect(getByTestId('locale').textContent).toBe('es');
      expect(getByTestId('translated').textContent).toBe('Pedido confirmado');
    });
  });

  it('does not override a stored locale preference', async () => {
    localStorage.setItem('makinari-locale', 'en');

    const { getByTestId } = render(
      <LocalizationProvider>
        <SiteLocaleProbe siteLocale="es" />
      </LocalizationProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(getByTestId('locale').textContent).toBe('en');
    expect(getByTestId('translated').textContent).toBe('Order Confirmed');
  });

  it('keeps locale and messages aligned after applyUnresolvedLocale resolves', async () => {
    const { getByRole, getByTestId } = render(
      <LocalizationProvider>
        <ManualApply />
      </LocalizationProvider>
    );

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'apply-es' }));
    });

    expect(getByTestId('locale').textContent).toBe('es');
    expect(getByTestId('translated').textContent).toBe('Pedido confirmado');
  });
});
