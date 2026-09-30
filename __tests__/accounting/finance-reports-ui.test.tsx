import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FinanceReportsClient } from '@/app/finance/components/FinanceReportsClient'
import { getAllAccounts } from '@/app/accounting/chart'
import { getBalanceSheetReport, getPnLReport } from '@/app/finance/reports'
import { downloadFinanceReport } from '@/app/finance/report-export'
import type { AccountingAccount } from '@/app/types'
import type { ReportAmounts } from '@/app/finance/report-types'
import { UNKNOWN_CURRENCY_MESSAGE } from '@/app/finance/report-errors'

let mockSite: { id: string; settings: { currency?: string } } | undefined
const mockTranslate = (key: string) => ({
  'accounting.pnl': 'Profit & Loss', 'accounting.bs': 'Balance Sheet', 'accounting.tb': 'Trial Balance',
  'accounting.inBalance': 'In Balance', 'accounting.outOfBalance': 'Out of Balance',
  'accounting.totalIncome': 'Total Income', 'accounting.totalExpenses': 'Total Expenses',
  'accounting.netIncome': 'Net Income', 'accounting.status': 'Status',
}[key] ?? key)

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: mockTranslate }) }))
jest.mock('@/app/accounting/chart', () => ({ getAllAccounts: jest.fn() }))
jest.mock('@/app/finance/reports', () => ({ getPnLReport: jest.fn(), getBalanceSheetReport: jest.fn() }))
jest.mock('@/app/finance/report-export', () => ({ ...jest.requireActual('@/app/finance/report-export'), downloadFinanceReport: jest.fn() }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: any) => <div>{children}</div> }))
jest.mock('@/app/components/dashboard/base-kpi-widget', () => ({
  BaseKpiWidget: ({ title, value }: any) => <section aria-label={title}>{value}</section>,
}))
jest.mock('@/app/components/ui/button', () => ({
  Button: ({ variant: _variant, size: _size, children, ...props }: any) => <button {...props}>{children}</button>,
}))
jest.mock('@/app/components/ui/date-range-picker', () => ({
  CalendarDateRangePicker: ({ onRangeChange }: any) => <button onClick={() => onRangeChange(new Date(2026, 0, 1), new Date(2026, 0, 31))}>January dates</button>,
}))
jest.mock('@/app/accounting/components/SyncJournalEntriesDialog', () => ({
  SyncJournalEntriesDialog: ({ open, onSynced }: any) => open ? <button onClick={onSynced}>Complete sync</button> : null,
}))
jest.mock('@/app/finance/components/TrialBalanceTable', () => ({ TrialBalanceTable: () => <div>Trial balance rows</div> }))

const account = (code: string, type: AccountingAccount['type']): AccountingAccount => ({
  id: code, siteId: 'site-a', code, key: null, label: `Account ${code}`, type, system: true, active: true,
  createdAt: '', updatedAt: '',
})
const amounts = (credit: number): ReportAmounts => ({ '4000': { debit: 0, credit } })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const selectTab = (label: string) => fireEvent.mouseDown(screen.getByRole('tab', { name: label }), { button: 0, ctrlKey: false })

beforeEach(() => {
  jest.clearAllMocks()
  mockSite = { id: 'site-a', settings: { currency: 'USD' } }
  jest.mocked(getAllAccounts).mockResolvedValue([account('4000', 'income'), account('1000', 'asset')])
  jest.mocked(getPnLReport).mockResolvedValue(amounts(10))
  jest.mocked(getBalanceSheetReport).mockResolvedValue({})
})

it('renders its imported buttons on the first render and does not show zero totals while loading', async () => {
  const pending = deferred<ReportAmounts>()
  jest.mocked(getPnLReport).mockReturnValue(pending.promise)
  render(<FinanceReportsClient />)
  expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled()
  expect(screen.getByRole('status', { name: 'Loading finance report' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Total Income' })).not.toBeInTheDocument()
  expect(screen.queryByText('In Balance')).not.toBeInTheDocument()
  await act(async () => pending.resolve(amounts(10)))
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('USD 10.00')
  expect(screen.getByRole('button', { name: 'Export report' })).toBeEnabled()
})

it('requires a selected currency rather than silently assuming USD', () => {
  mockSite = { id: 'site-a', settings: {} }
  render(<FinanceReportsClient />)
  expect(screen.getByText('Select a valid currency to load this report.')).toBeInTheDocument()
  expect(getPnLReport).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled()
})

it('shows report failures without totals or export and can retry successfully', async () => {
  jest.mocked(getPnLReport).mockRejectedValueOnce(new Error('Access denied'))
  render(<FinanceReportsClient />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Finance report unavailable')
  expect(screen.queryByRole('region', { name: 'Total Income' })).not.toBeInTheDocument()
  expect(screen.queryByText('In Balance')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('region', { name: 'Total Income' })).toHaveTextContent('USD 10.00')
})

it('explains that historical currency needs reconciliation instead of showing zero balances', async () => {
  jest.mocked(getPnLReport).mockRejectedValueOnce(new Error(UNKNOWN_CURRENCY_MESSAGE))
  render(<FinanceReportsClient />)
  expect(await screen.findByRole('alert')).toHaveTextContent(UNKNOWN_CURRENCY_MESSAGE)
  expect(screen.queryByRole('region', { name: 'Total Income' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled()
})

it('does not display an in-balance trial balance when its request fails', async () => {
  jest.mocked(getBalanceSheetReport).mockRejectedValue(new Error('Third page failed'))
  render(<FinanceReportsClient />)
  await screen.findByRole('region', { name: 'Total Income' })
  selectTab('Trial Balance')
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: 'Status' })).not.toBeInTheDocument()
  expect(screen.queryByText('In Balance')).not.toBeInTheDocument()
  expect(screen.queryByText('Trial balance rows')).not.toBeInTheDocument()
})

it.each(['failed', 'incomplete'])('fails closed for a %s chart of accounts', async kind => {
  if (kind === 'failed') jest.mocked(getAllAccounts).mockRejectedValue(new Error('Chart unavailable'))
  else jest.mocked(getAllAccounts).mockResolvedValue([])
  render(<FinanceReportsClient />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: 'Total Income' })).not.toBeInTheDocument()
})

it('selects a currency independently from the site default and ignores stale currency results', async () => {
  const usd = deferred<ReportAmounts>()
  const eur = deferred<ReportAmounts>()
  jest.mocked(getPnLReport).mockImplementation((_site, _from, _to, currency) => currency === 'EUR' ? eur.promise : usd.promise)
  render(<FinanceReportsClient />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Report currency' }), { target: { value: 'EUR' } })
  expect(getPnLReport).toHaveBeenLastCalledWith('site-a', expect.any(String), expect.any(String), 'EUR')
  await act(async () => eur.resolve(amounts(25)))
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('EUR 25.00')
  await act(async () => usd.resolve(amounts(999)))
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('EUR 25.00')
  expect(screen.getByRole('combobox')).toHaveValue('EUR')
  expect(mockSite?.settings.currency).toBe('USD')
  expect(screen.getByText(/EUR entries only. No currency conversion/)).toBeInTheDocument()
})

it('hides previous totals while the date range changes and ignores late date errors', async () => {
  const old = deferred<ReportAmounts>()
  jest.mocked(getPnLReport).mockReturnValueOnce(old.promise)
  render(<FinanceReportsClient />)
  fireEvent.click(screen.getByRole('button', { name: 'January dates' }))
  await screen.findByRole('region', { name: 'Total Income' })
  expect(getPnLReport).toHaveBeenLastCalledWith('site-a', '2026-01-01', '2026-01-31', 'USD')
  await act(async () => old.reject(new Error('Stale failure')))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('USD 10.00')
})

it('refresh hides previous results and a late refresh cannot replace the newest result', async () => {
  const old = deferred<ReportAmounts>()
  const latest = deferred<ReportAmounts>()
  render(<FinanceReportsClient />)
  await screen.findByRole('region', { name: 'Total Income' })
  jest.mocked(getPnLReport).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(screen.queryByRole('region', { name: 'Total Income' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await act(async () => latest.resolve(amounts(30)))
  await act(async () => old.resolve(amounts(99)))
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('USD 30.00')
})

it('removes previously successful totals if a refresh fails', async () => {
  render(<FinanceReportsClient />)
  await screen.findByRole('region', { name: 'Total Income' })
  jest.mocked(getPnLReport).mockRejectedValueOnce(new Error('Refresh failed'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: 'Total Income' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled()
  act(() => window.dispatchEvent(new CustomEvent('finance:exportReport')))
  expect(downloadFinanceReport).not.toHaveBeenCalled()
})

it('keeps a chosen currency when site settings finish loading in the background', async () => {
  mockSite = { id: 'site-a', settings: {} }
  const { rerender } = render(<FinanceReportsClient />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EUR' } })
  await screen.findByRole('region', { name: 'Total Income' })
  mockSite = { id: 'site-a', settings: { currency: 'USD' } }
  rerender(<FinanceReportsClient />)
  expect(screen.getByRole('combobox')).toHaveValue('EUR')
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('EUR 10.00')
})

it('resets currency and totals for another site and ignores the old site response', async () => {
  const old = deferred<ReportAmounts>()
  jest.mocked(getPnLReport).mockImplementation(site => site === 'site-a' ? old.promise : Promise.resolve(amounts(50)))
  const { rerender } = render(<FinanceReportsClient />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EUR' } })
  mockSite = { id: 'site-b', settings: { currency: 'GBP' } }
  rerender(<FinanceReportsClient />)
  expect(screen.getByRole('combobox')).toHaveValue('GBP')
  await screen.findByRole('region', { name: 'Total Income' })
  await act(async () => old.resolve(amounts(999)))
  expect(screen.getByRole('region', { name: 'Total Income' })).toHaveTextContent('GBP 50.00')
  expect(getAllAccounts).toHaveBeenLastCalledWith('site-b')
})

it('exports the latest selected currency and dates instead of the site default', async () => {
  render(<FinanceReportsClient />)
  await screen.findByRole('region', { name: 'Total Income' })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EUR' } })
  fireEvent.click(screen.getByRole('button', { name: 'January dates' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export report' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Export report' }))
  expect(downloadFinanceReport).toHaveBeenCalledWith(expect.stringContaining('"EUR",10'), 'pnl_EUR_2026-01-01_2026-01-31.csv')
  act(() => window.dispatchEvent(new CustomEvent('finance:exportReport')))
  expect(downloadFinanceReport).toHaveBeenCalledTimes(2)
})