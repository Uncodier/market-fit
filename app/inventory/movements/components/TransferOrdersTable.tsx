"use client"

import Link from "next/link"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { Pagination } from "@/app/components/ui/pagination"
import type { TransferOrder } from "../order-types"
import { transferLabel, transferTitle } from "../transfer-presentation"

export function TransferOrdersTable({ rows, demo, page, pageSize, count, onPageChange }: {
  rows: TransferOrder[]; demo: boolean; page: number; pageSize: number; count: number; onPageChange: (page: number) => void
}) {
  return <div className={documentListShellClassName()}>
    <Table className="min-w-[900px]"><TableHeader><TableRow>
      {["Document", "Status", "Origin", "Destination", "Receiver", "Created"].map(label => <DocumentListHead key={label}>{label}</DocumentListHead>)}
    </TableRow></TableHeader><TableBody>{rows.map(order => <DocumentListRow key={order.id}>
      <TableCell className="py-3.5"><Link href={`/inventory/movements/${order.id}${demo ? "?demo=1" : ""}`} className="block hover:underline"><EntityCell name={transferTitle(order)} secondary={order.notes} /></Link></TableCell>
      <TableCell><StatusDot status={order.status} label={transferLabel(order.status)} /></TableCell>
      <TableCell>{order.from_location_name || "—"}</TableCell><TableCell>{order.to_location_name || "—"}</TableCell>
      <TableCell>{order.receiving_user_name || "Unassigned"}</TableCell>
      <TableCell className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-US")}</TableCell>
    </DocumentListRow>)}</TableBody></Table>
    <div className="flex items-center justify-between border-t px-4 py-3"><p className="text-xs text-muted-foreground">Showing {Math.min((page - 1) * pageSize + 1, count)} – {Math.min(page * pageSize, count)} of {count} transfers</p>{count > pageSize && <Pagination currentPage={page} totalPages={Math.ceil(count / pageSize)} onPageChange={onPageChange} />}</div>
  </div>
}