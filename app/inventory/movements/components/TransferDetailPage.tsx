"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { getTransferOrder, transitionTransferOrder } from "../order-actions"
import type { TransferTransitionInput } from "../order-schema"
import { demoTransferOrders } from "../transfer-demo-data"
import { outstanding, transferLabel, transferStatuses, transferTitle } from "../transfer-presentation"
import { clearPendingTransition, pendingTransitionKey, readPendingTransition, writePendingTransition } from "../pending-transfer-transition"
import { TransferTransitionDialog } from "./TransferTransitionDialog"
import { TransferAbout, TransferActivity, TransferItems } from "./TransferDetailPanels"
import { TransferPrimaryAction, TransferSecondaryActions } from "./TransferHeaderActions"

export function TransferDetailPage({ orderId, demo }: { orderId: string; demo: boolean }) {
  const { currentSite } = useSite()
  const { user } = useAuthContext()
  const preview = demo || !!currentSite?.id?.startsWith("demo-")
  return <TransferDetailWorkspace key={`${user?.id}-${currentSite?.id}-${orderId}-${preview}`} actorId={user?.id} siteId={currentSite?.id} orderId={orderId} demo={preview} />
}
function TransferDetailWorkspace({ orderId, demo, siteId, actorId }: { orderId: string; demo: boolean; siteId?: string; actorId?: string }) {
  const permissions = useOptionalPermissions()
  const key = !demo && actorId && siteId ? pendingTransitionKey(actorId, siteId, orderId) : null
  const [restored] = useState(() => {
    try { return { pending: key ? readPendingTransition(key, actorId!, siteId!, orderId) : null, error: "" } }
    catch { return { pending: null, error: "Pending operation storage is unavailable or invalid. Resolve storage before changing this transfer." } }
  })
  const [pending, setPending] = useState(restored.pending)
  const [error, setError] = useState(restored.error)
  const [tab, setTab] = useState("items")
  const [action, setAction] = useState<TransferTransitionInput["action"] | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const { data, error: loadError, isLoading, mutate } = useSWR(!demo && siteId ? ["inventory-transfer-detail", siteId, orderId] : null, async () => {
    const result = await getTransferOrder(siteId!, orderId)
    if (result.error) throw new Error(result.error)
    return result.data
  }, { revalidateOnFocus: false, revalidateOnReconnect: false })
  const order = demo ? demoTransferOrders.find(order => order.id === orderId) : data
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("breadcrumb:update", { detail: { title: order ? transferTitle(order) : "Transfer", path: `/inventory/movements/${orderId}`, parent: { title: "Inventory Transfers", path: `/inventory/transfers${demo ? "?demo=1" : ""}` } } }))
  }, [order, orderId, demo])
  const submit = async (payload?: Pick<TransferTransitionInput, "lines" | "notes">) => {
    if (demo || !key || !actorId || !siteId || !order || submitting.current || restored.error || (!pending && !action)) return
    submitting.current = true; setBusy(true); setError("")
    try {
      const input = pending || { siteId, orderId, requestId: crypto.randomUUID(), action: action!, revision: order.revision, ...payload }
      writePendingTransition(key, actorId, input)
      setPending(input)
      setAction(null)
      const result = await transitionTransferOrder(input)
      if ("error" in result) {
        // A rejection after an uncertain attempt does not prove the earlier attempt failed.
        if (!pending && ([400, 403].includes(result.status) || (result.status === 409 && result.code === "operation_rejected"))) {
          clearPendingTransition(key); setPending(null)
          await mutate()
        }
        setError(`${result.error}${result.code ? ` (${result.code})` : ""}${result.status ? ` [${result.status}]` : ""}`)
        return
      }
      if (!result.success) throw new Error("Transfer operation could not be confirmed")
      clearPendingTransition(key); setPending(null)
      await mutate()
      window.dispatchEvent(new CustomEvent("inventory:reload"))
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Transfer operation could not be confirmed") }
    finally { submitting.current = false; setBusy(false) }
  }
  if (isLoading) return <div className="p-8 space-y-5" role="status" aria-label="Loading transfer"><Skeleton className="h-12 w-full" /><Skeleton className="h-80 w-full" /></div>
  if (!order) return <div className="p-8 space-y-4"><h1 className="text-xl font-semibold">{!siteId && !demo ? "Select a site" : "Transfer unavailable"}</h1><p role="alert">{loadError?.message || "This transfer could not be found in the selected workspace."}</p><Link href={`/inventory/transfers${demo ? "?demo=1" : ""}`}>Back to transfers</Link></div>
  const manager = permissions?.capabilities?.is_owner || permissions?.capabilities?.role === "owner" || permissions?.capabilities?.role === "admin"
  const writable = !permissions || permissions.can("update")
  const locked = demo || busy || !!pending || !!restored.error || !key || !writable
  const active = ["in_transit", "partially_received"].includes(order.status)
  const actions: TransferTransitionInput["action"][] = order.status === "draft" ? ["request", "cancel"] : order.status === "requested" ? [...(manager ? ["approve" as const] : []), "cancel"] : order.status === "approved" ? ["dispatch", "cancel"] : active ? [...(demo || manager || order.receiving_user_id === actorId ? ["receive" as const] : []), ...(demo || manager ? ["reconcile" as const] : [])] : []
  const total = order.lines.reduce((sum, line) => sum + outstanding(line), 0)
  const primaryAction = actions.find(value => value !== "cancel" && value !== "reconcile")
  const secondaryActions = actions.filter(value => value === "cancel" || value === "reconcile")
  const styles = Object.fromEntries(transferStatuses.map(status => [status, status === "cancelled" ? "bg-red-100 text-red-700" : status === "received" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"])) as Record<typeof transferStatuses[number], string>
  return <div className="flex-1 p-0 min-w-0">
    <TransferPrimaryAction action={primaryAction} pending={!!pending} disabled={pending ? busy || !!restored.error : locked} onSelect={setAction} onRetry={() => void submit()} />
    <Tabs value={tab} onValueChange={setTab}>
      <StickyHeader><div className="pt-0 flex-1 w-full min-w-0"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 w-full">
        <TabsList className="w-fit shrink-0"><TabsTrigger value="items">Items</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
        <div className="min-w-0 overflow-x-auto lg:max-w-[70%]" aria-label={`Overall status: ${transferLabel(order.status)}`}><ProgressiveStatusBar current={order.status} forwardPath={transferStatuses.filter(status => status !== "cancelled")} outcomes={["cancelled"]} styles={styles} labels={transferLabel} disabled onChange={() => {}} /></div>
      </div></div></StickyHeader>
      <div className="px-4 lg:px-8 py-5">
        <div className="space-y-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 min-w-0"><EntityAvatar name={transferTitle(order)} className="h-11 w-11 text-sm" /><div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight">{transferTitle(order)}</h1>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{order.from_location_name} → {order.to_location_name}</p>
            <p className="text-xs text-muted-foreground/80 mt-1">{transferLabel(order.status)} · {order.lines.length} product lines · Revision {order.revision}</p>
          </div></div>
          <div className="flex items-center gap-1 flex-shrink-0"><TransferSecondaryActions actions={secondaryActions} disabled={locked} onSelect={setAction} /></div>
        </div></div>
        <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
          <main className="w-full min-w-0 lg:flex-1 pt-5 lg:pr-8">
            {active && <p className="text-sm text-muted-foreground mb-5">{total.toLocaleString("en-US")} units in transit. Partial receipts leave outstanding units open.</p>}
            {pending && <p role="status" className="text-sm text-muted-foreground mb-5">Unconfirmed {pending.action} operation. Its original quantities, revision and request ID are locked. No automatic retry.</p>}
            {error && <p role="alert" className="text-sm text-destructive mb-5">{error}</p>}
            <TabsContent value="items" className="mt-0 pt-0"><TransferItems order={order} /></TabsContent>
            <TabsContent value="activity" className="mt-0 pt-0"><TransferActivity order={order} /></TabsContent>
          </main>
          <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 lg:border-l border-border/50"><div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto"><TransferAbout order={order} /></div></aside>
        </div>
      </div>
    </Tabs>
    {action && <TransferTransitionDialog order={order} action={action} busy={busy} onClose={() => setAction(null)} onSubmit={submit} />}
  </div>
}