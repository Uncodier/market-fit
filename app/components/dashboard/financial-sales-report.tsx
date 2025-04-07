"use client"

import React from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { HelpCircle } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

// Dummy data for sales details
const salesData = {
  summary: {
    totalSales: 125000,
    onlineSales: 85000,
    retailSales: 40000,
    unitsSold: 1250,
    averageOrderValue: 125,
    salesGrowth: 18.5,  // 18.5%
  },
  products: [
    { id: 1, name: "Product A", category: "Electronics", quantity: 320, revenue: 35000, growth: 22.4 },
    { id: 2, name: "Product B", category: "Clothing", quantity: 450, revenue: 25000, growth: 15.8 },
    { id: 3, name: "Product C", category: "Home", quantity: 280, revenue: 18000, growth: 19.3 },
    { id: 4, name: "Product D", category: "Electronics", quantity: 180, revenue: 12000, growth: 8.5 },
    { id: 5, name: "Product E", category: "Beauty", quantity: 210, revenue: 15000, growth: 25.6 },
    { id: 6, name: "Product F", category: "Home", quantity: 95, revenue: 10000, growth: 12.4 },
    { id: 7, name: "Product G", category: "Clothing", quantity: 150, revenue: 10000, growth: 15.7 },
  ]
}

export function FinancialSalesReport() {
  const { isDarkMode } = useTheme()
  
  // Helper for percentage display with color
  const renderPercentage = (value: number) => {
    const textColorClass = value > 0 ? "text-green-500" : "text-red-500"
      
    return (
      <span className={textColorClass}>
        {value >= 0 ? "+" : ""}{value.toFixed(1)}%
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sales Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sales
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Sum of all sales for the period
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${salesData.summary.totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(salesData.summary.salesGrowth)} from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Online Sales
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Sales made through online channels
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${salesData.summary.onlineSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(22.5)} from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Retail Sales
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Sales made through physical retail stores
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${salesData.summary.retailSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(12.8)} from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Order Value
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Average value of each transaction
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${salesData.summary.averageOrderValue}</div>
            <p className="text-xs text-muted-foreground">
              {renderPercentage(5.2)} from last month
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Sales by Product Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales by Product</CardTitle>
          <CardDescription>
            Breakdown of sales performance by product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Units Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">MoM Growth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesData.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-xs ${
                      product.category === 'Electronics' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : product.category === 'Clothing'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                          : product.category === 'Home'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}>
                      {product.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{product.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${product.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {renderPercentage(product.growth)}
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