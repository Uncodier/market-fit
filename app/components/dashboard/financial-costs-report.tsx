"use client"

import React from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { HelpCircle } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

// Dummy data for cost details
const costData = {
  summary: {
    totalCosts: 70000,
    fixedCosts: 25000,
    variableCosts: 45000,
    costOfGoodsSold: 55000,
    grossMargin: 0.35,  // 35%
    operatingExpenses: 15000
  },
  categories: [
    { id: 1, name: "Materials", type: "COGS", amount: 15000, percentage: 21.4 },
    { id: 2, name: "Labor", type: "COGS", amount: 25000, percentage: 35.7 },
    { id: 3, name: "Overhead", type: "COGS", amount: 10000, percentage: 14.3 },
    { id: 4, name: "Logistics", type: "COGS", amount: 5000, percentage: 7.1 },
    { id: 5, name: "Marketing", type: "OpEx", amount: 8000, percentage: 11.4 },
    { id: 6, name: "Admin", type: "OpEx", amount: 4000, percentage: 5.7 },
    { id: 7, name: "Office", type: "OpEx", amount: 3000, percentage: 4.3 },
  ]
}

export function FinancialCostsReport() {
  const { isDarkMode } = useTheme()
  
  // Helper for percentage display with color
  const renderPercentage = (value: number, inverted = false) => {
    const textColorClass = inverted
      ? (value > 0 ? "text-red-500" : "text-green-500")
      : (value > 0 ? "text-green-500" : "text-red-500")
      
    return (
      <span className={textColorClass}>
        {value >= 0 ? "+" : ""}{value.toFixed(1)}%
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cost Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Costs
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Sum of all costs for the period
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${costData.summary.totalCosts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(5.2, true)} from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cost of Goods Sold
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Direct costs attributable to the production of goods
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${costData.summary.costOfGoodsSold.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(4.3, true)} from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gross Margin
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Revenue minus cost of goods sold divided by revenue
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(costData.summary.grossMargin * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(0.8)} from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Operating Expenses
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Expenses that are not directly tied to production
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${costData.summary.operatingExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(2.1, true)} from last month
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Cost Categories Table */}
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
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="text-right">MoM Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costData.categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-xs ${
                      category.type === 'COGS' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {category.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">${category.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{category.percentage.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">
                    {renderPercentage(
                      Math.floor(Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1), 
                      true
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 