import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { Deal, STAGE_STYLES } from "@/app/deals/types"
import { Clock } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"

interface DealsTableProps {
  deals: Deal[]
  currentPage: number
  itemsPerPage: number
  totalDeals: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onDealClick: (deal: Deal) => void
}

export function DealsTable({ 
  deals,
  currentPage,
  itemsPerPage,
  totalDeals,
  onPageChange,
  onItemsPerPageChange,
  onDealClick
}: DealsTableProps) {
  const { t } = useLocalization()
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalDeals / itemsPerPage)
  
  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  }

  const formatTaskDate = (dateString: string | null) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const now = new Date()
    const isThisYear = date.getFullYear() === now.getFullYear()
    const isThisMonth = isThisYear && date.getMonth() === now.getMonth()
    
    if (isThisMonth) {
      // If it's this month, show day and short month (e.g., "Oct 15")
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } else if (isThisYear) {
      // If it's this year but different month, show short month (e.g., "Nov")
      return date.toLocaleDateString(undefined, { month: 'short' })
    } else {
      // If it's a different year, show month and year (e.g., "Jan 2024")
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    }
  }
  
  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">{t('deals.table.name') || 'Deal Name'}</TableHead>
              <TableHead className="w-[140px] min-w-[140px]">{t('deals.table.company') || 'Company'}</TableHead>
              <TableHead className="w-[120px] min-w-[120px]">{t('deals.table.amount') || 'Amount'}</TableHead>
              <TableHead className="w-[130px] min-w-[130px]">{t('deals.table.stage') || 'Stage'}</TableHead>
              <TableHead className="w-[130px] min-w-[130px]">{t('deals.table.score') || 'Score'}</TableHead>
              <TableHead className="w-[260px] min-w-[260px]">{t('deals.table.nextActivity') || 'Next Activity'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length > 0 ? (
              deals.map((deal) => (
                <TableRow 
                  key={deal.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onDealClick(deal)}
                >
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm line-clamp-2" title={deal.name}>{deal.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {deal.expected_close_date ? `${t('deals.table.closes') || 'Closes:'} ${new Date(deal.expected_close_date).toLocaleDateString()}` : (t('deals.table.noCloseDate') || "No close date")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="line-clamp-2" title={deal.companies?.name || deal.company?.name || "-"}>
                      {deal.companies?.name || deal.company?.name || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(deal.amount, deal.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STAGE_STYLES[deal.stage] || "bg-gray-100 text-gray-800"}`}>
                      {deal.stage.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {deal.qualification_score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${deal.qualification_score >= 80 ? 'bg-green-500' : deal.qualification_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, deal.qualification_score))}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{deal.qualification_score}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('deals.table.unscored') || 'Unscored'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div 
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border",
                        deal.next_task 
                          ? "text-muted-foreground bg-muted/20 border-border/60 hover:bg-muted/40 transition-colors" 
                          : "text-muted-foreground/60 bg-transparent border-transparent"
                      )}
                      title={deal.next_task ? `${t('deals.table.nextActivityPrefix') || 'Next activity:'} ${deal.next_task.title}${deal.next_task.scheduled_date ? ` ${t('deals.table.on') || 'on'} ${formatTaskDate(deal.next_task.scheduled_date)}` : ''}` : `${t('deals.table.nextActivityPrefix') || 'Next activity:'} ${t('deals.table.notScheduled') || 'Not scheduled'}`}
                    >
                      <Clock size={12} className={cn("flex-shrink-0", deal.next_task ? "text-primary/60" : "text-muted-foreground/40")} />
                      {deal.next_task ? (
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="truncate max-w-[160px] font-medium">{deal.next_task.title}</span>
                          {deal.next_task.scheduled_date && (
                            <span className="flex-shrink-0 opacity-70 border-l border-border/50 pl-1.5 whitespace-nowrap">
                              {formatTaskDate(deal.next_task.scheduled_date)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="truncate">{t('deals.table.notScheduled') || 'Not scheduled'}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {t('deals.table.noDeals') || 'No deals found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {t('deals.table.showing') || 'Showing'} <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalDeals || 1)}</span> {t('deals.table.to') || 'to'} <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalDeals)}</span> {t('deals.table.of') || 'of'} <span className="font-medium">{totalDeals}</span> {t('deals.table.dealsCount') || 'deals'}
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={onItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  )
} 
