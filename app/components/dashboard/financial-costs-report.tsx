"use client"

import React, { useState, useEffect } from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { HelpCircle } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Skeleton } from "@/app/components/ui/skeleton"

interface CostCategory {
  name: string;
  amount: number;
  prevAmount: number;
  percentChange: number;
}

interface FinancialCostsReportProps {
  categories?: CostCategory[];
}

// Default data for cost details
const defaultData = {
  summary: {
    totalCosts: 70000,
    fixedCosts: 25000,
    variableCosts: 45000,
    costOfGoodsSold: 55000,
    grossMargin: 0.35,  // 35%
    operatingExpenses: 15000
  },
  categories: [
    { name: "Materials", amount: 15000, prevAmount: 14000, percentChange: 7.1 },
    { name: "Labor", amount: 25000, prevAmount: 23000, percentChange: 8.7 },
    { name: "Overhead", amount: 10000, prevAmount: 9500, percentChange: 5.3 },
    { name: "Logistics", amount: 5000, prevAmount: 4800, percentChange: 4.2 },
    { name: "Marketing", amount: 8000, prevAmount: 7500, percentChange: 6.7 },
    { name: "Admin", amount: 4000, prevAmount: 3800, percentChange: 5.3 },
    { name: "Office", amount: 3000, prevAmount: 2900, percentChange: 3.4 },
  ]
}

export function FinancialCostsReport({ categories = defaultData.categories }: FinancialCostsReportProps) {
  const { isDarkMode } = useTheme()
  
  // Calculate totals safely
  const totalCosts = categories.reduce((sum, cat) => sum + (cat.amount || 0), 0)
  const totalPrevCosts = categories.reduce((sum, cat) => sum + (cat.prevAmount || 0), 0)
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
        <CardDescription>
          Detailed analysis of costs by category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">% of Total</TableHead>
              <TableHead className="text-right">MoM Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, index) => (
              <TableRow key={`category-${index}`}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-right">${category.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">${category.prevAmount.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {((category.amount / (totalCosts || 1)) * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  <span className={category.percentChange > 0 ? "text-red-500" : "text-green-500"}>
                    {formatPercentage(category.percentChange)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
} 