"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { formatSalesChange, formatSalesMoney, salesPercentChange } from "@/lib/sales/report-format"
import type { SalesCategory } from "@/lib/sales/report-types"

interface FinancialSalesBreakdownProps {
  categories?: SalesCategory[]
  currency?: string
}

export function FinancialSalesBreakdown({ categories = [], currency = "UNSPECIFIED" }: FinancialSalesBreakdownProps) {
  const total = categories.reduce((sum, row) => sum + row.amount, 0)
  const previous = categories.reduce((sum, row) => sum + row.prevAmount, 0)
  const money = (value: number) => formatSalesMoney(value, currency)
  const share = (amount: number) => total > 0 ? `${(amount / total * 100).toFixed(1)}%` : "—"
  return <Card>
    <CardHeader><CardTitle>Sales breakdown</CardTitle>
      <CardDescription>Allocated confirmed amounts by category, including categories with sales only in the previous period.</CardDescription>
    </CardHeader>
    <CardContent><Table>
      <TableHeader><TableRow>
        <TableHead>Category</TableHead><TableHead className="text-right">Current period</TableHead>
        <TableHead className="text-right">Previous period</TableHead><TableHead className="text-right">Share of current total</TableHead>
        <TableHead className="text-right">Period change</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {categories.map((category) => <TableRow key={category.name}>
          <TableCell className="font-medium">{category.name}</TableCell>
          <TableCell className="text-right">{money(category.amount)}</TableCell>
          <TableCell className="text-right">{money(category.prevAmount)}</TableCell>
          <TableCell className="text-right">{share(category.amount)}</TableCell>
          <TableCell className="text-right">{formatSalesChange(category.percentChange)}</TableCell>
        </TableRow>)}
        <TableRow className="border-t font-semibold">
          <TableCell>Total</TableCell><TableCell className="text-right">{money(total)}</TableCell>
          <TableCell className="text-right">{money(previous)}</TableCell><TableCell className="text-right">{share(total)}</TableCell>
          <TableCell className="text-right">{formatSalesChange(salesPercentChange(previous, total))}</TableCell>
        </TableRow>
      </TableBody>
    </Table></CardContent>
  </Card>
}