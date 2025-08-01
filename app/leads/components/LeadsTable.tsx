import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { ChevronLeft, ChevronRight, Mail, Phone } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { Lead, STATUS_STYLES } from "@/app/leads/types"
import { Segment } from "@/app/leads/types"

interface LeadsTableProps {
  leads: Lead[]
  currentPage: number
  itemsPerPage: number
  totalLeads: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onLeadClick: (lead: Lead) => void
  segments: Segment[]
}

export function LeadsTable({ 
  leads,
  currentPage,
  itemsPerPage,
  totalLeads,
  onPageChange,
  onItemsPerPageChange,
  onLeadClick,
  segments
}: LeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalLeads / itemsPerPage)
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Función para truncar texto largo - ya no se necesita para nombres
  const truncateText = (text: string, maxLength: number = 15) => {
    if (!text || text.length <= maxLength) return text
    return `${text.substring(0, maxLength)}...`
  }
  
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Name</TableHead>
            <TableHead className="w-[120px] min-w-[120px] max-w-[120px]">Phone</TableHead>
            <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Company</TableHead>
            <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Segment</TableHead>
            <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Status</TableHead>
            <TableHead className="w-[120px] min-w-[120px] max-w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {leads.length > 0 ? (
              leads.map((lead) => (
            <TableRow 
              key={lead.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onLeadClick(lead)}
            >
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm line-clamp-2" title={lead.name}>{lead.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2" title={lead.email}>{lead.email}</p>
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {lead.phone || "-"}
              </TableCell>
              <TableCell className="font-medium">
                <div className="line-clamp-2" title={typeof lead.company === 'string' ? lead.company : (lead.company?.name || "-")}>
                  {typeof lead.company === 'string' ? lead.company : (lead.company?.name || "-")}
                </div>
              </TableCell>
              <TableCell className="font-medium">
                <div className="line-clamp-2" title={getSegmentName(lead.segment_id)}>
                  {getSegmentName(lead.segment_id)}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${STATUS_STYLES[lead.status]}`}>
                  {lead.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`mailto:${lead.email}`)
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    <span className="sr-only">Email</span>
                  </Button>
                  {lead.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`tel:${lead.phone}`)
                      }}
                    >
                      <Phone className="h-4 w-4" />
                      <span className="sr-only">Call</span>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center">
              No leads found.
            </TableCell>
          </TableRow>
        )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalLeads)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalLeads)}</span> of <span className="font-medium">{totalLeads}</span> leads
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
    </Card>
  )
} 