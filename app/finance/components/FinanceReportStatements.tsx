"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/app/components/ui/table"
import { AccountingAccount } from "@/app/types"

type Amounts = Record<string, { debit: number; credit: number }>
type Translate = (key: string, params?: Record<string, string | number>) => string

interface StatementSharedProps {
  accounts: Record<string, AccountingAccount>
  formatCurrency: (val: number) => string
  t: Translate
}

function AccountRow({
  code,
  label,
  amount,
  formatCurrency,
  codeWidth = "w-[120px]",
}: {
  code: string
  label: string
  amount: number
  formatCurrency: (val: number) => string
  codeWidth?: string
}) {
  return (
    <TableRow className="hover:bg-muted/30 border-b-0 transition-colors">
      <TableCell className={`${codeWidth} font-mono text-xs text-muted-foreground`}>{code}</TableCell>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatCurrency(amount)}</TableCell>
    </TableRow>
  )
}

function TotalRow({
  label,
  amount,
  formatCurrency,
}: {
  label: string
  amount: number
  formatCurrency: (val: number) => string
}) {
  return (
    <TableRow className="bg-muted/10 hover:bg-muted/10">
      <TableCell colSpan={2} className="font-semibold">{label}</TableCell>
      <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(amount)}</TableCell>
    </TableRow>
  )
}

function sortedEntries(
  data: Amounts,
  accounts: Record<string, AccountingAccount>,
  type: AccountingAccount["type"],
) {
  return Object.entries(data)
    .filter(([code]) => accounts[code]?.type === type)
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
}

export function PnlStatementCard({
  accounts,
  pnlData,
  totalRevenue,
  totalExpense,
  netIncomePnL,
  pnlFrom,
  pnlTo,
  formatCurrency,
  t,
}: StatementSharedProps & {
  pnlData: Amounts
  totalRevenue: number
  totalExpense: number
  netIncomePnL: number
  pnlFrom: string
  pnlTo: string
}) {
  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="border-b bg-muted/10 pb-4">
        <CardTitle className="text-lg">{t('accounting.pnl')}</CardTitle>
        <CardDescription>
          {t('accounting.kpi.forPeriod', { from: pnlFrom, to: pnlTo })}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <div className="p-6">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.income')}</h3>
            <Table>
              <TableBody>
                {sortedEntries(pnlData, accounts, 'income').map(([code, amts]) => {
                  const acc = accounts[code]
                  const bal = amts.credit - amts.debit
                  if (bal === 0) return null
                  return (
                    <AccountRow
                      key={code}
                      code={code}
                      label={acc.label}
                      amount={bal}
                      formatCurrency={formatCurrency}
                    />
                  )
                })}
                <TotalRow label={t('accounting.totalIncome')} amount={totalRevenue} formatCurrency={formatCurrency} />
              </TableBody>
            </Table>
          </div>

          <div className="p-6 bg-muted/5">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.expenses')}</h3>
            <Table>
              <TableBody>
                {sortedEntries(pnlData, accounts, 'expense').map(([code, amts]) => {
                  const acc = accounts[code]
                  const bal = amts.debit - amts.credit
                  if (bal === 0) return null
                  return (
                    <AccountRow
                      key={code}
                      code={code}
                      label={acc.label}
                      amount={bal}
                      formatCurrency={formatCurrency}
                    />
                  )
                })}
                <TotalRow label={t('accounting.totalExpenses')} amount={totalExpense} formatCurrency={formatCurrency} />
              </TableBody>
            </Table>
          </div>

          <div className="p-6 bg-primary/5 flex items-center justify-between">
            <span className="font-bold text-lg">{t('accounting.netIncome')}</span>
            <span className={`font-mono font-bold text-xl tabular-nums ${netIncomePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netIncomePnL)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function BalanceSheetCard({
  accounts,
  bsData,
  totalAssets,
  totalLiabilities,
  totalEquity,
  bsNetIncome,
  bsAsOf,
  formatCurrency,
  t,
}: StatementSharedProps & {
  bsData: Amounts
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  bsNetIncome: number
  bsAsOf: string
}) {
  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="border-b bg-muted/10 pb-4">
        <CardTitle className="text-lg">{t('accounting.bs')}</CardTitle>
        <CardDescription>{t('accounting.kpi.asOf', { date: bsAsOf })}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
          <div className="p-6 h-full">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.assets')}</h3>
            <Table>
              <TableBody>
                {sortedEntries(bsData, accounts, 'asset').map(([code, amts]) => {
                  const acc = accounts[code]
                  const bal = amts.debit - amts.credit
                  if (bal === 0) return null
                  return (
                    <AccountRow
                      key={code}
                      code={code}
                      label={acc.label}
                      amount={bal}
                      formatCurrency={formatCurrency}
                      codeWidth="w-[100px]"
                    />
                  )
                })}
                <TotalRow label={t('accounting.totalAssets')} amount={totalAssets} formatCurrency={formatCurrency} />
              </TableBody>
            </Table>
          </div>

          <div className="divide-y flex flex-col">
            <div className="p-6">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.filter.liability')}</h3>
              <Table>
                <TableBody>
                  {sortedEntries(bsData, accounts, 'liability').map(([code, amts]) => {
                    const acc = accounts[code]
                    const bal = amts.credit - amts.debit
                    if (bal === 0) return null
                    return (
                      <AccountRow
                        key={code}
                        code={code}
                        label={acc.label}
                        amount={bal}
                        formatCurrency={formatCurrency}
                        codeWidth="w-[100px]"
                      />
                    )
                  })}
                  <TotalRow label={t('accounting.totalLiabilities')} amount={totalLiabilities} formatCurrency={formatCurrency} />
                </TableBody>
              </Table>
            </div>

            <div className="p-6 flex-1 bg-muted/5">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">{t('accounting.filter.equity')}</h3>
              <Table>
                <TableBody>
                  {sortedEntries(bsData, accounts, 'equity').map(([code, amts]) => {
                    const acc = accounts[code]
                    const bal = amts.credit - amts.debit
                    if (bal === 0) return null
                    return (
                      <AccountRow
                        key={code}
                        code={code}
                        label={acc.label}
                        amount={bal}
                        formatCurrency={formatCurrency}
                        codeWidth="w-[100px]"
                      />
                    )
                  })}
                  <TableRow className="border-b-0">
                    <TableCell className="w-[100px] font-mono text-xs text-transparent">-</TableCell>
                    <TableCell className="text-muted-foreground">{t('accounting.retainedEarnings')}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(bsNetIncome)}</TableCell>
                  </TableRow>
                  <TotalRow label={t('accounting.totalEquity')} amount={totalEquity} formatCurrency={formatCurrency} />
                </TableBody>
              </Table>
            </div>

            <div className="p-6 bg-primary/5 flex items-center justify-between border-t mt-auto">
              <span className="font-bold">{t('accounting.totalLiabAndEquity')}</span>
              <span className="font-mono font-bold text-lg tabular-nums">
                {formatCurrency(totalLiabilities + totalEquity)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
