"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Mail, Phone, Users } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Lead, Segment } from "@/app/leads/types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

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

function statusLabel(status: string) {
  if (status === "not_qualified") return "Not qualified"
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
}

function companyName(lead: Lead) {
  if (lead.companies?.name) return lead.companies.name
  if (lead.company && typeof lead.company === "object") return lead.company.name || null
  if (typeof lead.company === "string") return lead.company
  return null
}

export function LeadsTable({
  leads,
  currentPage,
  itemsPerPage,
  totalLeads,
  onPageChange,
  onItemsPerPageChange,
  onLeadClick,
  segments,
}: LeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalLeads / itemsPerPage)

  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return null
    return segments.find((segment) => segment.id === segmentId)?.name || null
  }

  if (leads.length === 0) {
    return (
      <EmptyCard
        icon={<Users className="h-16 w-16 text-muted-foreground" />}
        title="No leads found"
        description="There are no leads to display."
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[34%]">Lead</DocumentListHead>
              <DocumentListHead className="w-[22%]">Company</DocumentListHead>
              <DocumentListHead className="w-[16%]">Status</DocumentListHead>
              <DocumentListHead className="w-[16%]">Segment</DocumentListHead>
              <DocumentListHead className="w-[12%]" align="right">Actions</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <DocumentListRow key={lead.id} onClick={() => onLeadClick(lead)}>
                <TableCell className="py-3.5">
                  <EntityCell
                    name={lead.name}
                    secondary={lead.email || lead.phone}
                    meta={lead.position}
                    secondaryMono={false}
                  />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {companyName(lead) || "—"}
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={lead.status} label={statusLabel(lead.status)} />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {getSegmentName(lead.segment_id) || "—"}
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end gap-0.5">
                    {lead.email && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`mailto:${lead.email}`)}>
                            <Mail className="h-4 w-4" />
                            <span className="sr-only">Email</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Email</TooltipContent>
                      </Tooltip>
                    )}
                    {lead.phone && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`tel:${lead.phone}`)}>
                            <Phone className="h-4 w-4" />
                            <span className="sr-only">Call</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Call</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </DocumentListRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalLeads)}</span>
              {" – "}
              <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + itemsPerPage, totalLeads)}</span>
              {" of "}
              <span className="font-medium text-foreground">{totalLeads}</span> leads
            </p>
            <Select value={itemsPerPage.toString()} onValueChange={onItemsPerPageChange}>
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
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </div>
    </TooltipProvider>
  )
}
