"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getOrder, updateOrderStatus, updateOrderNotes, updateOrderItemStatus } from "../actions"
import { createShipment } from "@/app/shipments/actions"
import { listLocations } from "@/app/inventory/actions"
import { OrderWithRelations } from "../types"
import { toast } from "sonner"
import {
  ensureOrderPublicAccessToken,
  sendSaleOrder,
} from "@/app/orders/send-actions"
import { buildPublicDocPath } from "@/app/documents/public-token"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { navigateToShipment } from "@/lib/navigation/navigation-helpers"
import { getSaleById } from "@/app/sales/actions"
import { Sale } from "@/app/types"
import { OrderDetailView } from "./components/OrderDetailView"

export default function OrderDetail(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [savingLines, setSavingLines] = useState(false)
  const [isCreatingShipment, setIsCreatingShipment] = useState(false)
  const [modifiedLines, setModifiedLines] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [currentSale, setCurrentSale] = useState<Sale | null>(null)
  const [isLoadingSale, setIsLoadingSale] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await getOrder(params.id)
      if (error) {
        toast.error(t('orders.error.loadFailed') || "Failed to load order")
      } else if (data) {
        setOrder(data)
        setNotes(data.notes || "")
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite || !order) return
    setUpdatingStatus(true)
    const { data, error } = await updateOrderStatus(currentSite.id, order.id, newStatus)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t('orders.success.statusUpdated') || `Status updated to ${newStatus}`)
      setOrder(prev => prev ? { 
        ...prev, 
        status: newStatus as any,
        sale_order_items: newStatus === 'completed'
          ? prev.sale_order_items?.map((item: any) => ({ ...item, status: 'completed' }))
          : prev.sale_order_items
      } : null)
    }
    setUpdatingStatus(false)
  }

  const handleLineStatusChange = (itemId: string, newStatus: string) => {
    setModifiedLines(prev => ({ ...prev, [itemId]: newStatus }))
    setOrder(prev => prev ? { 
      ...prev, 
      sale_order_items: prev.sale_order_items?.map((item: any) => 
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    } : null)
  }

  const handleSaveLineItems = async () => {
    if (!order || !currentSite) return
    const idsToUpdate = Object.keys(modifiedLines)
    if (idsToUpdate.length === 0) return

    setSavingLines(true)
    try {
      // Loop over the updates and perform them
      // Alternatively we can use Promise.all to run them concurrently
      await Promise.all(
        idsToUpdate.map(itemId => 
          updateOrderItemStatus(currentSite.id, itemId, order.id, modifiedLines[itemId])
        )
      )
      
      toast.success(t('orders.success.lineItemsUpdated') || "Line items updated")
      setModifiedLines({})
    } catch (e: any) {
      toast.error(e.message || t('orders.error.lineItemsUpdateFailed') || "Failed to save line items")
    } finally {
      setSavingLines(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!currentSite || !order) return
    setSavingNotes(true)
    const { data, error } = await updateOrderNotes(currentSite.id, order.id, notes)
    
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t('orders.success.notesUpdated') || "Notes updated")
      setOrder(prev => prev ? { ...prev, notes: data.notes } : null)
    }
    setSavingNotes(false)
  }

  const handleCreateShipment = async () => {
    if (!order || !currentSite) {
      toast.error(t('orders.error.missingInfo') || "Required order info missing")
      return
    }

    setIsCreatingShipment(true)
    try {
      const locationsRes = await listLocations(currentSite.id)
      const locations = locationsRes.data || []
      const defaultLocation =
        locations.find((l) => l.is_default) || locations[0]

      if (!defaultLocation?.id) {
        toast.error(t('orders.error.noLocation') || "No valid location found to ship from. Add one in Settings.")
        setIsCreatingShipment(false)
        return
      }

      const res = await createShipment({
        siteId: currentSite.id,
        saleOrderId: order.id,
        saleId: order.sale_id || undefined,
        leadId: order.leads?.id || (order.sales as any)?.lead_id || undefined,
        originLocationId: defaultLocation.id,
        userId: (order as any).user_id,
      })
      if (res.error) throw new Error(res.error)
      if (res.data) {
        toast.success(t('orders.success.shipmentCreated') || "Shipment created")
        router.push(`/shipments/${res.data.id}`)
      }
    } catch (e: any) {
      toast.error(e.message || t('orders.error.shipmentCreateFailed') || "Failed to create shipment")
      setIsCreatingShipment(false)
    }
  }

  // Trigger breadcrumb update
  useEffect(() => {
    if (order) {
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: order.order_number,
          parent: {
            title: t('layout.sidebar.orders') || 'Orders',
            path: '/orders'
          }
        }
      });
      window.dispatchEvent(event);
    }
  }, [order, t]);

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/3"/><Skeleton className="h-64 w-full"/></div>
  }

  if (!order) return <div className="p-8">{t('orders.detail.notFound') || "Order not found"}</div>

  const items = order.sale_order_items && order.sale_order_items.length > 0 ? order.sale_order_items : (order.items || []);
  const lastEmailedAt = (order as any).last_emailed_at as string | null | undefined

  const handlePrint = () => {
    window.open(`/order-pdf/${order.id}`, "_blank")
  }

  const handleSend = async () => {
    if (!order || !currentSite) return
    if (!(order as any).leads?.email) {
      toast.error(
        t("orders.detail.sendMissingEmail") ||
          "Add a client email before sending this order"
      )
      return
    }
    setSending(true)
    try {
      const res = await sendSaleOrder(order.id)

      if (res.error) toast.error(res.error)
      else {
        toast.success(t("orders.detail.sentEmail") || "Order emailed with PDF attached")
        if (res.warning) toast.warning(res.warning)
        
        if (res.data) {
          setOrder({
            ...order,
            ...(res.data as any),
            leads: (res.data as any).leads || (order as any).leads,
          })
        }
      }
    } finally {
      setSending(false)
    }
  }

  const handleCopyClientLink = async () => {
    setSending(true)
    try {
      const tokenPromise = ensureOrderPublicAccessToken(order.id)
      
      const textPromise = tokenPromise.then(tokenRes => {
        if (tokenRes.error || !tokenRes.token) {
          throw new Error(tokenRes.error || "Failed to create public link")
        }
        return `${window.location.origin}${buildPublicDocPath("so", tokenRes.token)}`
      })

      if (typeof window.ClipboardItem !== "undefined" && navigator.clipboard.write) {
        const blobPromise = textPromise.then(text => new Blob([text], { type: "text/plain" }))
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": blobPromise
            })
          ])
          toast.success(t("orders.detail.linkCopied") || "Link copied to clipboard")
        } catch (err) {
          const text = await textPromise
          await navigator.clipboard.writeText(text)
          toast.success(t("orders.detail.linkCopied") || "Link copied to clipboard")
        }
      } else {
        const text = await textPromise
        await navigator.clipboard.writeText(text)
        toast.success(t("orders.detail.linkCopied") || "Link copied to clipboard")
      }

      const tokenRes = await tokenPromise
      if (tokenRes.token) {
        setOrder(prev => prev ? { ...prev, public_access_token: tokenRes.token } as any : prev)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create or copy public link")
    } finally {
      setSending(false)
    }
  }

  const handleOpenPayment = async () => {
    if (!order || !currentSite || !order.sale_id) return
    setIsLoadingSale(true)
    try {
      const res = await getSaleById(currentSite.id, order.sale_id)
      if (res.error || !res.sale) {
        toast.error(res.error || "Failed to load sale information")
      } else {
        setCurrentSale(res.sale)
        setIsPaymentModalOpen(true)
      }
    } finally {
      setIsLoadingSale(false)
    }
  }

  const handlePaymentSuccess = async () => {
    // Refresh the order to get updated payment status/amount
    if (order) {
      const { data } = await getOrder(order.id)
      if (data) {
        setOrder(data)
      }
    }
  }

  return (
    <OrderDetailView
      order={order}
      items={items}
      notes={notes}
      modifiedLines={modifiedLines}
      savingLines={savingLines}
      savingNotes={savingNotes}
      updatingStatus={updatingStatus}
      sending={sending}
      isCreatingShipment={isCreatingShipment}
      isLoadingSale={isLoadingSale}
      isPaymentModalOpen={isPaymentModalOpen}
      currentSale={currentSale}
      lastEmailedAt={lastEmailedAt}
      t={t}
      onNotesChange={setNotes}
      onLineStatusChange={handleLineStatusChange}
      onSaveLineItems={handleSaveLineItems}
      onSaveNotes={handleSaveNotes}
      onStatusChange={handleStatusChange}
      onOpenPayment={handleOpenPayment}
      onSend={handleSend}
      onCopyClientLink={handleCopyClientLink}
      onPrint={handlePrint}
      onCreateShipment={handleCreateShipment}
      onViewShipment={(shipmentId) =>
        navigateToShipment({ shipmentId, router })
      }
      onPaymentModalChange={setIsPaymentModalOpen}
      onPaymentSuccess={handlePaymentSuccess}
    />
  )
}
