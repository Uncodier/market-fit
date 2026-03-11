'use client'

import React from 'react'
import { useTheme } from '@/app/context/ThemeContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { HelpCircle } from '@/app/components/ui/icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'
import { Skeleton } from '@/app/components/ui/skeleton'

interface CostCategory {
  name: string
  amount: number
  prevAmount: number
  percentChange: number
}

interface FinancialCostsBreakdownProps {
  categories?: CostCategory[]
}

export function FinancialCostsBreakdown({ categories = [] }: FinancialCostsBreakdownProps) {
  const { t } = useLocalization()
  const { isDarkMode } = useTheme()
  
  // Calculate totals safely
  const totalCosts = categories.reduce((sum, cat) => sum + (cat.amount || 0), 0)
  const totalPrevCosts = categories.reduce((sum, cat) => sum + (cat.prevAmount || 0), 0)
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.reports.costBreakdown') || 'Cost Breakdown'}</CardTitle>
        <CardDescription>
          {t('dashboard.reports.costBreakdownDesc') || 'Detailed analysis of costs by category.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('dashboard.reports.category') || 'Category'}</TableHead>
              <TableHead className="text-right">{t('dashboard.reports.amount') || 'Amount'}</TableHead>
              <TableHead className="text-right">{t('dashboard.reports.previous') || 'Previous'}</TableHead>
              <TableHead className="text-right">{t('dashboard.reports.percentOfTotal') || '% of Total'}</TableHead>
              <TableHead className="text-right">{t('dashboard.reports.momChange') || 'MoM Change'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, idx) => {
              // Calculate percentage of total
              const percentOfTotal = totalCosts > 0 
                ? ((category.amount / totalCosts) * 100).toFixed(1) 
                : '0.0'
                
              // Determine color class for change percentage
              // For costs, negative change is good (costs decreased), positive is bad (costs increased)
              const changeColorClass = category.percentChange <= 0 
                ? 'text-green-500' 
                : 'text-red-500'
                
              return (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(category.amount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(category.prevAmount)}</TableCell>
                  <TableCell className="text-right">{percentOfTotal}%</TableCell>
                  <TableCell className={`text-right ${changeColorClass}`}>
                    {formatPercentage(category.percentChange)}
                  </TableCell>
                </TableRow>
              )
            })}
            
            {/* Totals row */}
            {categories.length > 0 && (
              <TableRow className="font-semibold border-t">
                <TableCell>{t('dashboard.reports.total') || 'Total'}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalCosts)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalPrevCosts)}</TableCell>
                <TableCell className="text-right">100.0%</TableCell>
                <TableCell className={`text-right ${totalPrevCosts > 0 && ((totalCosts - totalPrevCosts) / totalPrevCosts * 100) <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPrevCosts > 0 
                    ? formatPercentage(((totalCosts - totalPrevCosts) / totalPrevCosts * 100)) 
                    : '+100.0%'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}


