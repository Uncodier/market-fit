"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import { Button } from "@/app/components/ui/button"
import {
  PlusCircle,
  Printer,
  SplitSquareHorizontal,
  User,
} from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import {
  normalizePrintersSettings,
  ticketBrandFromSite,
} from "@/lib/printer"
import {
  printPosReceiptManually,
  receiptFromPosCart,
} from "@/app/pos/print-after-checkout"
import type { PosCartItem } from "./CartPanel"
import { PosCustomerPickerDialog } from "./PosCustomerPickerDialog"
import { loadCartSession } from "@/app/pos/local/cart-session"

interface PosReceiptActionsProps {
  cart: PosCartItem[]
  subtotal: number
  taxTotal: number
  total: number
  discountTotal: number
  notes?: string
  fulfillment: string
  currency: string
  leadValue: RelationSelectValue | string
  setLeadValue: (value: RelationSelectValue) => void
  leads: Array<{
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
  }>
  originLocationId: string
  locations: Array<{ id: string; name?: string | null }>
  siteId?: string
  onLeadUpdated?: (lead: {
    id: string
    name: string
    email: string
    phone?: string | null
  }) => void
  onNewOrder: () => void
  onSplitBill: () => void
  label: (key: string, fallback: string) => string
}

const ACTION_BUTTON =
  "h-14 w-14 !min-w-0 !p-0 !rounded-full text-muted-foreground"

export function PosReceiptActions({
  cart,
  subtotal,
  taxTotal,
  total,
  discountTotal,
  notes,
  fulfillment,
  currency,
  leadValue,
  setLeadValue,
  leads,
  originLocationId,
  locations,
  siteId,
  onLeadUpdated,
  onNewOrder,
  onSplitBill,
  label,
}: PosReceiptActionsProps) {
  const { currentSite } = useSite()
  const [printing, setPrinting] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [requestedByName, setRequestedByName] = useState<string | null>(null)

  useEffect(() => {
    if (siteId) {
      void loadCartSession(siteId).then((session) => {
        setRequestedByName(session.sellerName || null)
      })
    }
    const handleSellerState = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail
      setRequestedByName(detail?.name || null)
    }
    window.addEventListener("pos:seller-state", handleSellerState)
    return () =>
      window.removeEventListener("pos:seller-state", handleSellerState)
  }, [siteId])

  const handlePrint = async () => {
    if (cart.length === 0 || printing) return
    setPrinting(true)
    try {
      const customerName =
        typeof leadValue === "string"
          ? leads.find((lead) => lead.id === leadValue)?.name || null
          : leadValue?.label || null
      const locationName =
        locations.find((location) => location.id === originLocationId)?.name ||
        null
      const target = await printPosReceiptManually({
        settings: normalizePrintersSettings(currentSite?.settings?.printers),
        receipt: receiptFromPosCart({
          cart,
          total,
          notes,
          brand: ticketBrandFromSite(currentSite),
          customerName,
          requestedByName,
          fulfillment,
          locationName,
          currency,
          subtotal,
          taxTotal,
          discountTotal,
        }),
      })

      toast.success(
        target === "printer"
          ? label("pos.cart.receiptSent", "Receipt sent to printer")
          : label("pos.cart.systemPrintOpened", "System print dialog opened"),
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : label("pos.cart.receiptPrintFailed", "Could not print receipt"),
      )
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <div className="grid grid-rows-4 justify-items-center gap-2">
        <Button
          variant="secondary"
          className={ACTION_BUTTON}
          disabled={cart.length === 0}
          onClick={onSplitBill}
          title={label("pos.cart.splitTitle", "Split Bill")}
          aria-label={label("pos.cart.splitTitle", "Split Bill")}
        >
          <SplitSquareHorizontal className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          className={ACTION_BUTTON}
          disabled={cart.length === 0 || printing}
          onClick={() => void handlePrint()}
          title={label("pos.cart.printReceipt", "Print Receipt")}
          aria-label={label("pos.cart.printReceipt", "Print Receipt")}
        >
          <Printer className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          className={ACTION_BUTTON}
          onClick={() => setCustomerPickerOpen(true)}
          title={label("pos.cart.selectCustomer", "Select Customer")}
          aria-label={label("pos.cart.selectCustomer", "Select Customer")}
        >
          <User className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          className={ACTION_BUTTON}
          onClick={onNewOrder}
          title={label("pos.newOrder", "New Order")}
          aria-label={label("pos.newOrder", "New Order")}
        >
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>
      <PosCustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        leads={leads}
        value={leadValue}
        onSelect={setLeadValue}
        siteId={siteId}
        onLeadUpdated={onLeadUpdated}
        label={label}
      />
    </>
  )
}
