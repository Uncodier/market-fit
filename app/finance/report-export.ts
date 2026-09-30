import type { AccountingAccount } from '@/app/types'
import type { FinanceReportTab, ReportAmounts } from './report-types'

type CsvCell = string | number

export function financeReportCsv({ tab, currency, amounts, accounts }: {
  tab: FinanceReportTab
  currency: string
  amounts: ReportAmounts
  accounts: Record<string, AccountingAccount>
}): string {
  const rows: CsvCell[][] = [tab === 'pnl'
    ? ['Account Code', 'Account Name', 'Type', 'Currency', 'Balance']
    : ['Account Code', 'Account Name', 'Type', 'Currency', 'Debit', 'Credit', 'Balance']]
  let netIncome = 0
  for (const [code, amount] of Object.entries(amounts).sort(([a], [b]) => a.localeCompare(b))) {
    const account = accounts[code]
    if (!account) throw new Error('A report account is missing')
    const balance = amount.debit - amount.credit
    if (tab === 'pnl') {
      if (account.type !== 'income' && account.type !== 'expense') continue
      netIncome -= balance
      if (balance !== 0) rows.push([code, account.label, account.type, currency,
        account.type === 'income' ? -balance : balance])
    } else if (balance !== 0) {
      const displayBalance = ['liability', 'equity', 'income'].includes(account.type) ? -balance : balance
      rows.push([code, account.label, account.type, currency, Math.max(0, balance), Math.max(0, -balance), displayBalance])
    }
  }
  if (tab === 'pnl') rows.push(['', 'Net Income', '', currency, netIncome])
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}

function csvCell(value: CsvCell): string {
  if (typeof value === 'number') return String(value)
  // Spreadsheet formula prefixes are escaped as text as well as CSV delimiters.
  const safe = /^[\t\r\n]|^\s*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function downloadFinanceReport(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}