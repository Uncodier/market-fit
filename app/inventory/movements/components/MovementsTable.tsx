"use client"

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { Pagination } from "@/app/components/ui/pagination"
import { Skeleton } from "@/app/components/ui/skeleton"
import type { InventoryMovement } from "../types"
import Link from "next/link"

const movementLabels: Record<InventoryMovement["kind"], string> = { transfer: "Transfer", receipt: "Receipt", adjustment: "Adjustment", dispatch: "Dispatch", receive: "Transfer receipt", return: "Return to origin", writeoff: "Write off" }

export function MovementsTable({ rows, page, pageSize, count, onPageChange }: {
  rows: InventoryMovement[]; page: number; pageSize: number; count: number; onPageChange: (page: number) => void
}) {
  return <div className={documentListShellClassName()}>
    <Table className="min-w-[1000px]">
      <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
        <TableRow className="hover:bg-transparent">
          <DocumentListHead>Item</DocumentListHead>
          <DocumentListHead>Type</DocumentListHead>
          <DocumentListHead>Source</DocumentListHead>
          <DocumentListHead>Location</DocumentListHead>
          <DocumentListHead>Receiver</DocumentListHead>
          <DocumentListHead>Date</DocumentListHead>
          <DocumentListHead align="right">Quantity</DocumentListHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map(row => <DocumentListRow key={row.id}>
        <TableCell className="py-3.5">{row.transfer_order_id ? <Link href={`/inventory/movements/${row.transfer_order_id}`} className="block hover:underline"><EntityCell name={row.item_name || "Unknown item"} secondary={row.notes} /></Link> : <EntityCell name={row.item_name || "Unknown item"} secondary={row.notes} />}</TableCell>
        <TableCell><StatusDot status={row.kind === "transfer" || row.kind === "dispatch" ? "in_transit" : row.kind === "receipt" || row.kind === "receive" ? "completed" : "manual"} label={movementLabels[row.kind]} /></TableCell>
        <TableCell className="text-sm">{row.from_location_name || "—"}</TableCell>
        <TableCell className="text-sm">{row.to_location_name || "—"}</TableCell>
        <TableCell className="text-sm">{row.receiving_user_name || "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</TableCell>
        <TableCell className="text-right text-[15px] font-semibold tabular-nums">{row.quantity.toLocaleString("en-US")}</TableCell>
      </DocumentListRow>)}</TableBody>
    </Table>
    <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">Showing {Math.min((page - 1) * pageSize + 1, count)} – {Math.min(page * pageSize, count)} of {count} movements</p>
      {count > pageSize && <Pagination currentPage={page} totalPages={Math.ceil(count / pageSize)} onPageChange={onPageChange} />}
    </div>
  </div>
}

export function MovementsTableSkeleton() {
  return <div className={documentListShellClassName()} role="status" aria-label="Loading inventory movements">
    <Table><TableBody>{Array.from({ length: 6 }, (_, index) => <TableRow key={index}>
      {Array.from({ length: 7 }, (_, cell) => <TableCell key={cell} className="py-5"><Skeleton className="h-5 w-24" /></TableCell>)}
    </TableRow>)}</TableBody></Table>
  </div>
}