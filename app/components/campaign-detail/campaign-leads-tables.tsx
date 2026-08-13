"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { formatCurrency } from "@/app/lib/formatters"
import { format } from "date-fns"
import { Lead } from "@/app/leads/types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function companyName(lead: Lead) {
  if (typeof lead.company === "object" && lead.company?.name) return lead.company.name
  if (typeof lead.company === "string") return lead.company
  return null
}

function statusLabel(status: string) {
  if (status === "not_qualified") return "Not qualified"
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
}

function formatLeadDate(dateString?: string | null) {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return dateString
  }
}

export function CampaignLeadsTables({
  campaignLeads,
  loadingLeads,
  addLeadButton,
}: {
  campaignLeads: Lead[]
  loadingLeads: boolean
  addLeadButton: React.ReactNode
}) {
  const router = useRouter()
  const convertedLeads = campaignLeads.filter((lead) => lead.status === "converted")

  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-medium">Leads</h3>
          {addLeadButton}
        </div>
        {loadingLeads ? (
          <p className="text-sm text-muted-foreground py-3">Loading leads...</p>
        ) : campaignLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No leads yet.</p>
        ) : (
          <div className={documentListShellClassName()}>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <DocumentListHead className="w-[40%]">Name</DocumentListHead>
                  <DocumentListHead className="w-[18%]">Status</DocumentListHead>
                  <DocumentListHead className="w-[42%]">Date added</DocumentListHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignLeads.map((lead) => (
                  <DocumentListRow key={lead.id} accent="none" onClick={() => router.push(`/leads/${lead.id}`)}>
                    <TableCell className="py-3.5">
                      <EntityCell
                        name={lead.name}
                        secondary={lead.email || lead.phone}
                        secondaryMono={false}
                        meta={companyName(lead)}
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusDot status={lead.status} label={statusLabel(lead.status)} />
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {formatLeadDate(lead.created_at)}
                    </TableCell>
                  </DocumentListRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium mb-1">Converted</h3>
        {loadingLeads ? (
          <p className="text-sm text-muted-foreground py-3">Loading converted leads...</p>
        ) : convertedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No converted leads yet.</p>
        ) : (
          <div className={documentListShellClassName()}>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <DocumentListHead className="w-[40%]">Name</DocumentListHead>
                  <DocumentListHead className="w-[32%]">Date converted</DocumentListHead>
                  <DocumentListHead className="w-[28%]" align="right">
                    Value
                  </DocumentListHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convertedLeads.map((lead) => (
                  <DocumentListRow key={lead.id} accent="none" onClick={() => router.push(`/leads/${lead.id}`)}>
                    <TableCell className="py-3.5">
                      <EntityCell
                        name={lead.name}
                        secondary={lead.email || lead.phone}
                        secondaryMono={false}
                        meta={companyName(lead)}
                      />
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {formatLeadDate(lead.created_at)}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <MoneyCell amountLabel={formatCurrency((lead as { value?: number }).value || 0)} />
                    </TableCell>
                  </DocumentListRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  )
}
