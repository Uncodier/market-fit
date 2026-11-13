import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import type { TransferOrderDetail } from "../order-types"
import { lineStatus, outstanding, transferLabel } from "../transfer-presentation"

export function TransferItems({ order }: { order: TransferOrderDetail }) {
  return <section aria-label="Transfer product lines" className="space-y-4">
    <div><h2 className="text-sm font-semibold">Product lines</h2><p className="text-xs text-muted-foreground mt-1">Requested, dispatched and accepted quantities for each product.</p></div>
    <div className="overflow-x-auto rounded-lg border"><Table className="min-w-[680px]"><TableHeader><TableRow>{["Item", "Line status", "Requested", "Dispatched", "Received", "Outstanding"].map(label => <TableHead key={label} className={label === "Item" || label === "Line status" ? undefined : "text-right"}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{order.lines.map(line => <TableRow key={line.id}>
      <TableCell className="font-medium min-w-[160px]">{line.item_name}<details className="mt-2 font-normal text-xs text-muted-foreground"><summary className="cursor-pointer">Differences</summary><dl className="mt-2 space-y-1"><div>Returned: {line.returned_quantity.toLocaleString("en-US")}</div><div>Written off: {line.written_off_quantity.toLocaleString("en-US")}</div><div>Not dispatched: {(line.requested_quantity - line.dispatched_quantity).toLocaleString("en-US")}</div></dl></details></TableCell>
      <TableCell className="min-w-[160px]"><p className="text-sm">{order.status === "received" && line.dispatched_quantity === 0 ? "Unfulfilled · not dispatched" : lineStatus(line)}</p>{line.discrepancy_notes && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{line.discrepancy_notes}</p>}</TableCell>
      {[line.requested_quantity, line.dispatched_quantity, line.received_quantity, outstanding(line)].map((value, index) => <TableCell key={index} className="tabular-nums text-right">{value.toLocaleString("en-US")}</TableCell>)}
    </TableRow>)}</TableBody></Table></div>
  </section>
}
export function TransferAbout({ order }: { order: TransferOrderDetail }) {
  return <div className="w-full min-w-0"><h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">About this transfer</h2><dl className="divide-y divide-border/40">{[
    ["Origin", order.from_location_name], ["Destination", order.to_location_name], ["Requester", order.requested_by],
    ["Receiver", order.receiving_user_name || order.receiving_user_id || "Unassigned"], ["Notes", order.notes || "No notes"],
    ["Created", new Date(order.created_at).toLocaleString("en-US")], ["Revision", String(order.revision)],
  ].map(([label, value]) => <div key={label} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 py-3"><dt className="text-xs text-muted-foreground pt-0.5">{label}</dt><dd className="text-sm break-words whitespace-pre-wrap">{value || "—"}</dd></div>)}</dl></div>
}
export function TransferActivity({ order }: { order: TransferOrderDetail }) {
  return <section className="space-y-4"><h2 className="text-sm font-semibold">Activity</h2><p className="text-xs text-muted-foreground">This document’s workflow history. Effective stock movements are recorded separately in the Inventory Ledger.</p>{!order.events.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}{order.events.map(event => <article key={event.id} className="border-l-2 pl-4 space-y-1"><h3 className="text-sm font-medium">{transferLabel(event.action)}</h3><p className="text-xs text-muted-foreground">{event.actor_id} · {new Date(event.created_at).toLocaleString("en-US")}</p><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Operation details</summary><pre className="whitespace-pre-wrap break-all mt-2">{JSON.stringify(event.payload, null, 2)}</pre></details></article>)}</section>
}