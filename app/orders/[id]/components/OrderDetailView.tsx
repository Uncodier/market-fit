"use client"

import { Button } from "@/app/components/ui/button"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { ActionFooter } from "@/app/components/ui/card-footer"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Link,
  Loader2,
  Mail,
  Printer,
  Save,
  Send,
} from "@/app/components/ui/icons"
import {
  SectionCard,
  SectionCardContent,
  SectionCardHeader,
  SectionCardTitle,
} from "@/app/components/ui/section-card"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Textarea } from "@/app/components/ui/textarea"
import { RegisterPaymentDialog } from "@/app/sales/components/RegisterPaymentDialog"
import { Sale } from "@/app/types"
import { OrderInvoiceDocument } from "../../components/OrderInvoiceDocument"
import { OrderStatusBar } from "../../components/OrderStatusBar"
import { OrderWithRelations } from "../../types"

type OrderDetailViewProps = {
  order: OrderWithRelations
  items: any[]
  notes: string
  modifiedLines: Record<string, string>
  savingLines: boolean
  savingNotes: boolean
  updatingStatus: boolean
  sending: boolean
  isCreatingShipment: boolean
  isLoadingSale: boolean
  isPaymentModalOpen: boolean
  currentSale: Sale | null
  lastEmailedAt?: string | null
  t: (key: string) => string
  onNotesChange: (value: string) => void
  onLineStatusChange: (itemId: string, status: string) => void
  onSaveLineItems: () => void
  onSaveNotes: () => void
  onStatusChange: (status: string) => void
  onOpenPayment: () => void
  onSend: () => void
  onCopyClientLink: () => void
  onPrint: () => void
  onCreateShipment: () => void
  onViewShipment: (shipmentId: string) => void
  onPaymentModalChange: (open: boolean) => void
  onPaymentSuccess: () => void
}

function identityName(identity?: {
  name?: string | null
  email?: string | null
} | null) {
  return identity?.name?.trim() || identity?.email?.trim() || "Not recorded"
}

function identityInitials(identity?: {
  name?: string | null
  email?: string | null
} | null) {
  const value = identityName(identity)
  if (value === "Not recorded") return "—"
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : value.slice(0, 2)
  ).toUpperCase()
}

function AttributionIdentity({
  label,
  identity,
}: {
  label: string
  identity?: { name?: string | null; email?: string | null } | null
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted text-[10px]">
          {identityInitials(identity)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">
          {identityName(identity)}
        </div>
      </div>
    </div>
  )
}

export function OrderDetailView(props: OrderDetailViewProps) {
  const {
    order,
    items,
    notes,
    modifiedLines,
    savingLines,
    savingNotes,
    updatingStatus,
    sending,
    isCreatingShipment,
    isLoadingSale,
    isPaymentModalOpen,
    currentSale,
    lastEmailedAt,
    t,
  } = props
  const hasShipments = Boolean(order.shipments?.length)

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,64px))] flex-1 flex-col bg-muted/30">
      <Tabs defaultValue="details" className="flex flex-1 flex-col">
        <StickyHeader>
          <div className="flex w-full items-center justify-between gap-3 overflow-x-auto pt-0">
            <div className="flex min-w-0 flex-shrink-0 items-center gap-3">
              <TabsList>
                <TabsTrigger value="details">{t("orders.detail.tabs.details") || "Details"}</TabsTrigger>
                <TabsTrigger value="shipments">{t("orders.detail.tabs.shipments") || "Shipments"}</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1">
                {order.status !== "cancelled" && Number(order.sales?.amount_due) > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={props.onOpenPayment}
                      disabled={isLoadingSale}
                      className="flex items-center gap-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                    >
                      <CreditCard className="h-4 w-4" />
                      {t("orders.detail.payOnline") || "Pay Online"}
                    </Button>
                    <div className="mx-1 h-6 w-px bg-border" />
                  </>
                )}
                {order.status !== "cancelled" && (
                  <>
                    <Button variant="ghost" size="sm" onClick={props.onSend} disabled={sending} className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {lastEmailedAt
                        ? t("orders.detail.resendEmail") || "Resend"
                        : t("orders.detail.sendEmail") || "Email"}
                    </Button>
                    <div className="mx-1 h-6 w-px bg-border" />
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={props.onCopyClientLink} disabled={sending} className="flex items-center gap-1">
                  <Link className="h-4 w-4" />
                  {t("orders.detail.clientLink") || "Client Link"}
                </Button>
                <div className="mx-1 h-6 w-px bg-border" />
                <Button variant="ghost" size="sm" onClick={props.onPrint} className="flex items-center gap-1">
                  <Printer className="h-4 w-4" />
                  {t("common.print") || "Print"}
                </Button>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center justify-end">
              <OrderStatusBar
                currentStatus={order.status}
                onStatusChange={props.onStatusChange}
                disabled={updatingStatus}
              />
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <TabsContent value="details" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              <OrderInvoiceDocument
                order={order}
                items={items}
                savingLines={savingLines}
                hasModifiedLines={Object.keys(modifiedLines).length > 0}
                onLineStatusChange={props.onLineStatusChange}
                onSaveLineItems={props.onSaveLineItems}
              />

              <SectionCard>
                <SectionCardHeader>
                  <SectionCardTitle>Attribution</SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent className="grid gap-4 sm:grid-cols-3">
                  <AttributionIdentity
                    label="Created by"
                    identity={order.created_by}
                  />
                  <AttributionIdentity label="Seller" identity={order.seller} />
                  <AttributionIdentity
                    label="Requested by"
                    identity={order.requested_by}
                  />
                </SectionCardContent>
              </SectionCard>

              {hasShipments && (
                <SectionCard>
                  <SectionCardHeader>
                    <SectionCardTitle className="flex items-center gap-2">
                      <Send className="h-4 w-4" /> {t("orders.detail.shipments") || "Shipments"}
                    </SectionCardTitle>
                  </SectionCardHeader>
                  <SectionCardContent className="space-y-3">
                    <div className="text-sm font-medium">
                      {order.shipments!.length} {t("orders.detail.shipmentsAssociated") || "shipment(s) associated"}
                    </div>
                    <div className="space-y-2">
                      {order.shipments!.slice(0, 3).map((shipment: any) => (
                        <div key={shipment.id} className="border-l-2 border-border pl-2 text-sm">
                          <div>{t(`shipments.status.${shipment.status}`) || shipment.status.replace("_", " ")}</div>
                          {shipment.tracking_number && (
                            <div className="font-mono text-xs text-muted-foreground">{shipment.tracking_number}</div>
                          )}
                          <button
                            type="button"
                            onClick={() => props.onViewShipment(shipment.id)}
                            className="mt-1 inline-flex cursor-pointer items-center gap-1 font-medium text-primary hover:underline"
                          >
                            {t("orders.detail.view") || "View"} <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </SectionCardContent>
                </SectionCard>
              )}

              <SectionCard>
                <SectionCardHeader>
                  <SectionCardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    {t("orders.detail.notes") || "Notes"}
                  </SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent>
                  <Textarea
                    placeholder={t("orders.detail.notesPlaceholder") || "Add internal notes about this order..."}
                    value={notes}
                    onChange={(event) => props.onNotesChange(event.target.value)}
                    className="min-h-[72px]"
                  />
                </SectionCardContent>
                <ActionFooter>
                  <Button
                    variant="outline"
                    onClick={props.onSaveNotes}
                    disabled={savingNotes || notes === (order.notes || "")}
                    size="sm"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {t("orders.detail.saveNotes") || "Save Notes"}
                  </Button>
                </ActionFooter>
              </SectionCard>

              {order.status === "pending" && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="mb-1 text-lg font-semibold text-destructive">
                        {t("orders.detail.dangerZone") || "Danger Zone"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("orders.detail.irreversibleActions") || "Actions in this section cannot be undone"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="mb-1 font-medium">{t("orders.detail.cancelOrder") || "Cancel Order"}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("orders.detail.cancelDescription") ||
                            "Cancel this order. This will not automatically reverse related sales or shipments."}
                        </p>
                      </div>
                      <Button variant="destructive" type="button" onClick={() => props.onStatusChange("cancelled")} disabled={updatingStatus}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {t("orders.detail.cancelOrder") || "Cancel Order"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="shipments" className="m-0 border-0 p-0">
            <div className="mx-auto max-w-[800px] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t("orders.detail.associatedShipments") || "Associated Shipments"}</h3>
                <Button type="button" variant="outline" size="sm" onClick={props.onCreateShipment} disabled={isCreatingShipment}>
                  {isCreatingShipment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {t("orders.detail.createShipment") || "Create Shipment"}
                </Button>
              </div>
              {!hasShipments ? (
                <div className="rounded-xl border border-border/70 bg-card py-10 text-center text-sm text-muted-foreground">
                  <Send className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  {t("orders.detail.noShipments") || "No shipments created for this order yet."}
                </div>
              ) : (
                <div className={documentListShellClassName()}>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <DocumentListHead className="w-[48%]">{t("orders.detail.trackingCarrier") || "Tracking / Carrier"}</DocumentListHead>
                        <DocumentListHead className="w-[32%]">{t("orders.detail.status") || "Status"}</DocumentListHead>
                        <DocumentListHead className="w-[20%]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.shipments!.map((shipment: any) => {
                        const hasTracking = Boolean(shipment.tracking_number)
                        const cancelled = shipment.status === "cancelled" || shipment.status === "failed"
                        const accent = cancelled
                          ? "cancelled"
                          : shipment.status === "pending" ||
                              shipment.status === "preparing" ||
                              (["shipped", "in_transit"].includes(shipment.status) && !hasTracking)
                            ? "due"
                            : "none"
                        const statusLabel =
                          t(`orders.status.${shipment.status}`) ||
                          t(`shipments.status.${shipment.status}`) ||
                          String(shipment.status).replace(/_/g, " ")
                        return (
                          <DocumentListRow key={shipment.id} onClick={() => props.onViewShipment(shipment.id)} accent={accent}>
                            <TableCell className="py-3.5">
                              <EntityCell
                                name={shipment.carrier || (t("orders.detail.notAssigned") || "Not assigned")}
                                secondary={hasTracking ? shipment.tracking_number : null}
                              />
                            </TableCell>
                            <TableCell className="py-3.5">
                              <StatusDot status={shipment.status} label={statusLabel} />
                            </TableCell>
                            <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => props.onViewShipment(shipment.id)}
                                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-muted/50 hover:text-foreground group-hover:opacity-100 md:opacity-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">{t("common.open") || "Open"}</span>
                              </button>
                            </TableCell>
                          </DocumentListRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
      <RegisterPaymentDialog
        open={isPaymentModalOpen}
        onOpenChange={props.onPaymentModalChange}
        sale={currentSale}
        onSuccess={props.onPaymentSuccess}
      />
    </div>
  )
}
