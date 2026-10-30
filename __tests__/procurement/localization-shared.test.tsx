import { render, screen, fireEvent } from '@testing-library/react'
import { LocalizationProvider, useLocalization } from '@/app/context/LocalizationContext'
import { AmountField, Choice } from '@/app/purchases/procurement/components/form-fields'
import { ProcurementLoading } from '@/app/purchases/procurement/ui/loading'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { procurementRouteTitle } from '@/lib/navigation/procurement-route-title'
import { useState } from 'react'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))

function Display() {
  const { setLocale } = useLocalization()
  const { t, message, valueLabel } = useProcurementI18n()
  const [amount, setAmount] = useState(1234)
  return <>
    {(['en', 'es', 'fr', 'de', 'ja'] as const).map(locale => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}
    <h1>{procurementRouteTitle('/purchases/rules', t)}</h1>
    <p>{message('Target must exceed the minimum')}</p>
    <span data-testid="status">{valueLabel('submitted')}</span>
    <AmountField label="Example amount" currency="MXN" value={amount} onChange={setAmount} />
    <output data-testid="minor">{amount}</output>
    <Choice label="Decision" value="human" options={['human', 'automatic_ai']} onChange={() => undefined} />
    <ProcurementLoading />
  </>
}
test('language changes update shared labels, navigation and diagnostics without resetting quantities or performing network operations', () => {
  localStorage.clear(); document.cookie = 'makinari-locale=; Max-Age=0; path=/'
  jest.mocked(fetch).mockClear()
  render(<LocalizationProvider preferenceScope="i18n-test"><Display /></LocalizationProvider>)
  const input = screen.getByLabelText('Example amount (MXN, net of tax)')
  fireEvent.change(input, { target: { value: '12.30' } })
  const expected = { en: 'Procurement Rules', es: 'Reglas de compras', fr: 'Règles d’achat', de: 'Beschaffungsregeln', ja: '購買ルール' }
  for (const [locale, title] of Object.entries(expected)) {
    fireEvent.click(screen.getByRole('button', { name: locale }))
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByTestId('minor')).toHaveTextContent('1230')
    expect(input).toHaveValue('12.30')
    if (locale !== 'en') expect(screen.queryByText('Target must exceed the minimum')).not.toBeInTheDocument()
  }
  expect(fetch).not.toHaveBeenCalled()
})