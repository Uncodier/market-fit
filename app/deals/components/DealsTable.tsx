import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { Deal, STAGE_STYLES } from "@/app/deals/types"

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
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalDeals / itemsPerPage)
  
  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  }
  
  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Deal Name</TableHead>
              <TableHead className="w-[140px] min-w-[140px]">Company</TableHead>
              <TableHead className="w-[120px] min-w-[120px]">Amount</TableHead>
              <TableHead className="w-[130px] min-w-[130px]">Stage</TableHead>
              <TableHead className="w-[130px] min-w-[130px]">Score</TableHead>
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
                        {deal.expected_close_date ? `Closes: ${new Date(deal.expected_close_date).toLocaleDateString()}` : "No close date"}
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
                      <span className="text-xs text-muted-foreground">Unscored</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No deals found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalDeals || 1)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalDeals)}</span> of <span className="font-medium">{totalDeals}</span> deals
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
