import { downloadFinanceReport, financeReportCsv } from '@/app/finance/report-export'
import type { AccountingAccount } from '@/app/types'

const account = (code: string, type: AccountingAccount['type'], label: string) => ({
  id: code, siteId: 'site', code, key: null, type, label, system: false, active: true, createdAt: '', updatedAt: '',
})

it('escapes comma, quote and newline labels and includes the unconverted selected currency', () => {
  const csv = financeReportCsv({
    tab: 'pnl', currency: 'EUR',
    accounts: { '4000': account('4000', 'income', 'Sales, "Online"\nRetail') },
    amounts: { '4000': { debit: 0, credit: 1234.56 } },
  })
  expect(csv).toBe('"Account Code","Account Name","Type","Currency","Balance"\r\n' +
    '"4000","Sales, ""Online""\nRetail","income","EUR",1234.56\r\n' +
    '"","Net Income","","EUR",1234.56')
})

it('neutralizes spreadsheet formulas without changing numeric debit and credit amounts', () => {
  const csv = financeReportCsv({
    tab: 'tb', currency: 'USD', accounts: { '1000': account('1000', 'asset', '=SUM(1,2)') },
    amounts: { '1000': { debit: 0, credit: 25 } },
  })
  expect(csv).toContain('"1000","\'=SUM(1,2)","asset","USD",0,25,-25')
})

it('creates a Blob download and releases its temporary URL and DOM element', () => {
  jest.useFakeTimers()
  URL.createObjectURL = jest.fn(() => 'blob:finance-test')
  URL.revokeObjectURL = jest.fn()
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('pnl_EUR.csv')
    expect(this.href).toBe('blob:finance-test')
    expect(this.isConnected).toBe(true)
  })
  try {
    downloadFinanceReport('"Currency"\r\n"EUR"', 'pnl_EUR.csv')
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a')).toBeNull()
    jest.runOnlyPendingTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:finance-test')
  } finally {
    click.mockRestore()
    jest.useRealTimers()
  }
})