"use client"

import { Star, PieChart, BarChart } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Badge } from "@/app/components/ui/badge"

interface FinancialStatsProps {
  revenue?: {
    actual?: number
    projected?: number
    estimated?: number
    currency?: string
  }
  budget?: {
    allocated?: number
    remaining?: number
    currency?: string
  }
  costs?: {
    fixed?: number
    variable?: number
    total?: number
    currency?: string
  }
  className?: string
}

export function FinancialStats({
  revenue,
  budget,
  costs,
  className
}: FinancialStatsProps) {
  // Format currency
  const formatCurrency = (amount: number | undefined, currency = "USD") => {
    if (amount === undefined) return "-"
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Calculate total revenue
  const totalRevenue = revenue?.actual || revenue?.projected || revenue?.estimated || 0
  
  // Calculate ROI if we have both revenue and costs
  const roi = costs?.total && totalRevenue ? 
    ((totalRevenue - costs.total) / costs.total * 100).toFixed(0) : null

  return (
    <div className={cn("space-y-6", className)}>
      {/* Revenue Section - Always shown */}
      <div className="bg-emerald-100/20 dark:bg-emerald-900/10 rounded-lg p-4 border-none">
        <div className="flex items-center mb-3">
          <Star className="h-4 w-4 text-emerald-500 mr-2" />
          <span className="font-medium text-emerald-800 dark:text-emerald-400">Revenue</span>
          {roi && (
            <Badge 
              className={cn(
                "ml-auto text-xs", 
                parseInt(roi) >= 0 
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" 
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
              )}
            >
              ROI: {roi}%
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-emerald-100/80 dark:bg-emerald-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Actual</div>
            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(revenue?.actual || 0, revenue?.currency)}
            </div>
          </div>
          
          <div className="bg-emerald-100/80 dark:bg-emerald-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Projected</div>
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {formatCurrency(revenue?.projected || 0, revenue?.currency)}
            </div>
          </div>
          
          <div className="bg-emerald-100/80 dark:bg-emerald-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Estimated</div>
            <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {formatCurrency(revenue?.estimated || 0, revenue?.currency)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Budget Section - Always shown */}
      <div className="bg-blue-100/20 dark:bg-blue-900/10 rounded-lg p-4 border-none">
        <div className="flex items-center mb-3">
          <BarChart className="h-4 w-4 text-blue-500 mr-2" />
          <span className="font-medium text-blue-800 dark:text-blue-400">Budget</span>
          <Badge 
            className={cn(
              "ml-auto text-xs", 
              (budget?.remaining || 0) >= 0 
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            )}
          >
            {(budget?.remaining || 0) >= 0 ? "Within budget" : "Over budget"}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-blue-100/80 dark:bg-blue-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Allocated</div>
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {formatCurrency(budget?.allocated || 0, budget?.currency)}
            </div>
          </div>
          
          <div className="bg-blue-100/80 dark:bg-blue-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Remaining</div>
            <div className={cn(
              "text-sm font-medium", 
              (budget?.remaining || 0) >= 0 
                ? "text-green-600 dark:text-green-400" 
                : "text-red-600 dark:text-red-400"
            )}>
              {formatCurrency(budget?.remaining || 0, budget?.currency)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Costs Section - Always shown */}
      <div className="bg-red-100/20 dark:bg-red-900/10 rounded-lg p-4 border-none">
        <div className="flex items-center mb-3">
          <PieChart className="h-4 w-4 text-red-500 mr-2" />
          <span className="font-medium text-red-800 dark:text-red-400">Costs</span>
          <Badge 
            className="ml-auto text-xs bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
          >
            {Math.round(((costs?.fixed || 0) / (costs?.total || 1)) * 100)}% fixed
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-red-100/80 dark:bg-red-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Fixed</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {formatCurrency(costs?.fixed || 0, costs?.currency)}
            </div>
          </div>
          
          <div className="bg-red-100/80 dark:bg-red-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Variable</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {formatCurrency(costs?.variable || 0, costs?.currency)}
            </div>
          </div>
          
          <div className="bg-red-100/80 dark:bg-red-900/50 p-3 rounded-md">
            <div className="text-xs text-muted-foreground mb-1.5">Total</div>
            <div className="text-sm font-medium text-red-600 dark:text-red-400">
              {formatCurrency(costs?.total || 0, costs?.currency)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 