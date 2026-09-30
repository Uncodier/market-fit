"use client"

import { format, parse } from 'date-fns'
import type { AccountingAccount } from '@/app/types'
import { useLocalization } from '@/app/context/LocalizationContext'
import { BaseKpiWidget } from '@/app/components/dashboard/base-kpi-widget'
import { AlertTriangle } from '@/app/components/ui/icons'
import type { FinanceReportTab, ReportAmounts } from '../report-types'
import { PnlStatementCard, BalanceSheetCard } from './FinanceReportStatements'
import { TrialBalanceTable } from './TrialBalanceTable'

export function FinanceReportContent({ accounts, amounts, tab, currency, from, to, asOf }: {
  accounts: Record<string, AccountingAccount>
  amounts: ReportAmounts
  tab: FinanceReportTab
  currency: string
  from: string
  to: string
  asOf: string
}) {
  const { t } = useLocalization()
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency, currencyDisplay: 'code',
  }).format(value)
  const formatDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')
  const asOfText = `${t('accounting.kpi.asOf', { date: formatDate(asOf) })} (UTC)`
  let income = 0, expense = 0, assets = 0, liabilities = 0, equity = 0, debits = 0, credits = 0
  for (const [code, amount] of Object.entries(amounts)) {
    const balance = amount.debit - amount.credit
    const type = accounts[code].type
    if (type === 'income') income -= balance
    if (type === 'expense') expense += balance
    if (type === 'asset') assets += balance
    if (type === 'liability') liabilities -= balance
    if (type === 'equity') equity -= balance
    debits += Math.max(0, balance)
    credits += Math.max(0, -balance)
  }
  const netIncome = income - expense
  const totalEquity = equity + netIncome
  const balanced = Math.abs(debits - credits) <= 0.01
  const statementProps = { accounts, formatCurrency, t }

  if (tab === 'pnl') return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <BaseKpiWidget isLoading={false} title={t('accounting.totalIncome')} value={formatCurrency(income)} changeText={t('accounting.kpi.selectedPeriod')} />
        <BaseKpiWidget isLoading={false} title={t('accounting.totalExpenses')} value={formatCurrency(expense)} changeText={t('accounting.kpi.selectedPeriod')} />
        <BaseKpiWidget isLoading={false} title={t('accounting.netIncome')} value={formatCurrency(netIncome)}
          changeText={`${netIncome >= 0 ? t('accounting.profit') : t('accounting.loss')} ${t('accounting.kpi.thisPeriod')}`}
          isPositiveChange={netIncome >= 0} />
      </div>
      <PnlStatementCard {...statementProps} pnlData={amounts} totalRevenue={income} totalExpense={expense}
        netIncomePnL={netIncome} pnlFrom={formatDate(from)} pnlTo={`${formatDate(to)} (UTC)`} />
    </div>
  )

  if (tab === 'bs') return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <BaseKpiWidget isLoading={false} title={t('accounting.totalAssets')} value={formatCurrency(assets)} changeText={asOfText} />
        <BaseKpiWidget isLoading={false} title={t('accounting.totalLiabilities')} value={formatCurrency(liabilities)} changeText={asOfText} />
        <BaseKpiWidget isLoading={false} title={t('accounting.totalEquity')} value={formatCurrency(totalEquity)} changeText={asOfText} />
      </div>
      {Math.abs(assets - liabilities - totalEquity) > 0.01 && (
        <div className="bg-red-50 text-red-900 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">{t('accounting.bsWarning') || 'Balance Sheet is out of balance'}</h4>
            <p className="text-sm mt-1">
              Assets ({formatCurrency(assets)}) do not equal Liabilities + Equity ({formatCurrency(liabilities + totalEquity)}).
              Difference: {formatCurrency(Math.abs(assets - liabilities - totalEquity))}
            </p>
          </div>
        </div>
      )}
      <BalanceSheetCard {...statementProps} bsData={amounts} totalAssets={assets} totalLiabilities={liabilities}
        totalEquity={totalEquity} bsNetIncome={netIncome} bsAsOf={`${formatDate(asOf)} (UTC)`} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <BaseKpiWidget isLoading={false} title={t('accounting.totalDebits')} value={formatCurrency(debits)} changeText={asOfText} />
        <BaseKpiWidget isLoading={false} title={t('accounting.totalCredits')} value={formatCurrency(credits)} changeText={asOfText} />
        <BaseKpiWidget isLoading={false} title={t('accounting.status')} value={balanced ? t('accounting.inBalance') : t('accounting.outOfBalance')}
          changeText={balanced ? t('accounting.debitsMatchCredits') : t('accounting.kpi.differenceOf', { amount: formatCurrency(Math.abs(debits - credits)) })}
          isPositiveChange={balanced} />
      </div>
      <TrialBalanceTable accounts={accounts} bsData={amounts} totalDebits={debits} totalCredits={credits} formatCurrency={formatCurrency} />
    </div>
  )
}