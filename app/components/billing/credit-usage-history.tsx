"use client"

import { useSite } from "@/app/context/SiteContext"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Download, FileText } from "../ui/icons"
import { Button } from "../ui/button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { EmptyState } from "../ui/empty-state"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"

export interface CreditTransaction {
  id: string
  site_id: string
  amount: number
  transaction_type: string
  description?: string
  metadata?: any
  created_at: string
}

interface CreditUsageHistoryProps {
  className?: string
}

export function CreditUsageHistory({ className }: CreditUsageHistoryProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const { isDarkMode } = useTheme()
  const [isDownloading, setIsDownloading] = useState(false)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastLoadedSiteId, setLastLoadedSiteId] = useState<string | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  
  const loadHistory = async (page = 1) => {
    if (!currentSite) return
    
    // Calculate range for pagination
    const from = (page - 1) * itemsPerPage
    const to = from + itemsPerPage - 1
    
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Get data with pagination
      const { data, error, count } = await supabase
        .from('credit_transactions')
        .select('*', { count: 'exact' })
        .eq('site_id', currentSite.id)
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (error) {
        console.error("Error fetching credit transactions:", error)
        if (page === 1) setTransactions([])
      } else if (!data || data.length === 0) {
        if (page === 1) setTransactions([])
      } else {
        setTransactions(data)
        if (count !== null) setTotalCount(count)
      }
      
      setLastLoadedSiteId(currentSite.id)
    } catch (error) {
      console.error("Error loading credit transactions:", error)
      toast.error("Failed to load credit history")
      if (page === 1) setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    if (!currentSite) {
      setIsLoading(false)
      return
    }
    
    // Reset to page 1 when site changes
    if (currentSite.id !== lastLoadedSiteId) {
      setCurrentPage(1)
      loadHistory(1)
    } else {
      loadHistory(currentPage)
    }
  }, [currentSite?.id, currentPage])

  // Get all data for the chart and CSV (without pagination)
  const [allTransactions, setAllTransactions] = useState<CreditTransaction[]>([])
  const [isLoadingAll, setIsLoadingAll] = useState(false)

  useEffect(() => {
    const loadAllTransactions = async () => {
      if (!currentSite) return
      
      try {
        setIsLoadingAll(true)
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('site_id', currentSite.id)
          .order('created_at', { ascending: false })
        
        if (!error && data) {
          setAllTransactions(data)
        }
      } catch (error) {
        console.error("Error loading all credit transactions:", error)
      } finally {
        setIsLoadingAll(false)
      }
    }
    
    if (currentSite?.id) {
      loadAllTransactions()
    }
  }, [currentSite?.id])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }
  
  const handleDownloadCSV = () => {
    setIsDownloading(true)
    try {
      if (allTransactions.length === 0) {
        toast.error("No data to download")
        return
      }

      // Create CSV header
      const headers = ['Date', 'Type', 'Amount', 'Description']
      
      // Create CSV rows
      const rows = allTransactions.map(t => {
        const date = new Date(t.created_at).toISOString()
        const type = t.transaction_type || ''
        const amount = t.amount || 0
        const description = t.description ? `"${t.description.replace(/"/g, '""')}"` : ''
        return `${date},${type},${amount},${description}`
      })

      const csvContent = [headers.join(','), ...rows].join('\n')
      
      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `credit_usage_${currentSite?.id}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('CSV downloaded successfully')
    } catch (error) {
      console.error('Error downloading CSV:', error)
      toast.error('Failed to download CSV')
    } finally {
      setIsDownloading(false)
    }
  }
  
  const getTransactionColor = (amount: number) => {
    if (amount > 0) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (amount < 0) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
  
  const formatAmount = (amount: number) => {
    const sign = amount > 0 ? '+' : ''
    return `${sign}${amount}`
  }

  // Process data for the chart using all transactions
  // Group by day and sum amounts
  const chartData = [...allTransactions].reverse().reduce((acc: any[], curr) => {
    const dateStr = new Date(curr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const existing = acc.find(item => item.date === dateStr)
    
    if (existing) {
      if (curr.amount < 0) {
        existing.usage += Math.abs(curr.amount)
      } else {
        existing.added += curr.amount
      }
    } else {
      acc.push({
        date: dateStr,
        fullDate: curr.created_at,
        usage: curr.amount < 0 ? Math.abs(curr.amount) : 0,
        added: curr.amount > 0 ? curr.amount : 0
      })
    }
    
    return acc
  }, [])

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const colors = {
    text: isDarkMode ? "#CBD5E1" : "#9CA3AF",
    grid: isDarkMode ? "rgba(203, 213, 225, 0.2)" : "#f0f0f0",
    tooltipBackground: isDarkMode ? "#1E293B" : "white",
    tooltipBorder: isDarkMode ? "#475569" : "#e5e7eb",
    tooltipText: isDarkMode ? "#F8FAFC" : "#111827",
    usageLine: isDarkMode ? "#F87171" : "#EF4444",
    addedLine: isDarkMode ? "#34D399" : "#10B981"
  }

  return (
    <div className={className}>
      {isLoading ? (
        <Card className="border dark:border-white/5 border-black/5 shadow-sm">
          <CardHeader className="px-8 py-6">
            <CardTitle className="text-xl font-semibold">{t('billing.credits.history.title') || 'Credit Usage History'}</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('billing.credits.history.desc') || 'View your credit usage and purchase history.'}
              </p>
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('billing.credits.history.loading') || 'Loading credit history...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-primary" />}
          title={t('billing.credits.history.emptyTitle') || "No credit history"}
          description={t('billing.credits.history.emptyDesc') || "You haven't used or purchased any credits yet."}
          className="h-[600px]"
        />
      ) : (
        <Card id="credit-history" className="border dark:border-white/5 border-black/5 shadow-sm">
          <CardHeader className="px-8 py-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">{t('billing.credits.history.title') || 'Credit Usage History'}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('billing.credits.history.desc') || 'View your credit usage and purchase history.'}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              disabled={isDownloading}
              onClick={handleDownloadCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('billing.credits.history.download') || 'Download CSV'}
            </Button>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="space-y-8">
              
              {/* Chart section */}
              {chartData.length > 0 && (
                <div className="w-full h-[300px] mt-4 mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        vertical={false} 
                        stroke={colors.grid} 
                        opacity={isDarkMode ? 0.6 : 1}
                      />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: colors.text }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: colors.text }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: colors.tooltipBackground, 
                          border: `1px solid ${colors.tooltipBorder}`,
                          borderRadius: '0.375rem', 
                        }}
                        itemStyle={{ color: colors.tooltipText }}
                        labelStyle={{ fontWeight: 'bold', color: colors.tooltipText }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="usage" 
                        name={t('billing.credits.history.chart.used') || "Credits Used"}
                        stroke={colors.usageLine} 
                        strokeWidth={2}
                        dot={{ r: 3, fill: colors.usageLine }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="added" 
                        name={t('billing.credits.history.chart.added') || "Credits Added"}
                        stroke={colors.addedLine} 
                        strokeWidth={2}
                        dot={{ r: 3, fill: colors.addedLine }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table section */}
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">{t('billing.credits.table.date') || 'Date'}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('billing.credits.table.type') || 'Type'}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('billing.credits.table.desc') || 'Description'}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('billing.credits.table.amount') || 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">{formatDate(transaction.created_at)}</td>
                        <td className="px-4 py-3 capitalize">{transaction.transaction_type?.replace(/_/g, ' ') || (t('billing.credits.table.unknown') || 'Unknown')}</td>
                        <td className="px-4 py-3">{transaction.description || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`${getTransactionColor(transaction.amount)}`}>
                            {formatAmount(transaction.amount)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t('billing.credits.pagination.showing') || 'Showing'} {(currentPage - 1) * itemsPerPage + 1} {t('billing.credits.pagination.to') || 'to'} {Math.min(currentPage * itemsPerPage, totalCount)} {t('billing.credits.pagination.of') || 'of'} {totalCount} {t('billing.credits.pagination.entries') || 'entries'}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                    >
                      {t('billing.credits.pagination.prev') || 'Previous'}
                    </Button>
                    <div className="flex items-center px-4 text-sm font-medium">
                      {t('billing.credits.pagination.page') || 'Page'} {currentPage} {t('billing.credits.pagination.ofPage') || 'of'} {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || isLoading}
                    >
                      {t('billing.credits.pagination.next') || 'Next'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
