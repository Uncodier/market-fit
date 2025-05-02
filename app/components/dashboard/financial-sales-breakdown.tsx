"use client"

import React from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { HelpCircle } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Skeleton } from "@/app/components/ui/skeleton"

interface SalesCategory {
  name: string;
  amount: number;
  prevAmount: number;
  percentChange: number;
}

interface FinancialSalesBreakdownProps {
  categories?: SalesCategory[];
}

export function FinancialSalesBreakdown({ categories = [] }: FinancialSalesBreakdownProps) {
  const { isDarkMode } = useTheme();
  
  // Calculate totals safely
  const totalSales = categories.reduce((sum, cat) => sum + (cat.amount || 0), 0);
  const totalPrevSales = categories.reduce((sum, cat) => sum + (cat.prevAmount || 0), 0);
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Breakdown</CardTitle>
        <CardDescription>
          Detailed analysis of sales by product category.
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
            {categories.map((category, idx) => {
              // Calculate percentage of total
              const percentOfTotal = totalSales > 0 
                ? ((category.amount / totalSales) * 100).toFixed(1) 
                : '0.0';
                
              // Determine color class for change percentage
              const changeColorClass = category.percentChange >= 0 
                ? 'text-green-500' 
                : 'text-red-500';
                
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
              );
            })}
            
            {/* Totals row */}
            {categories.length > 0 && (
              <TableRow className="font-semibold border-t">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totalSales)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalPrevSales)}</TableCell>
                <TableCell className="text-right">100.0%</TableCell>
                <TableCell className={`text-right ${totalPrevSales > 0 && ((totalSales - totalPrevSales) / totalPrevSales * 100) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPrevSales > 0 
                    ? formatPercentage(((totalSales - totalPrevSales) / totalPrevSales * 100)) 
                    : '+100.0%'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 