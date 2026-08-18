"use client";

import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { resolveRelationId } from "@/app/commerce/resolve-relation";
import { roundMoney } from "@/app/commerce/taxes";
import type { CheckoutLine } from "@/app/commerce/checkout";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import { getPosCheckoutGate } from "@/app/pos/checkout-gates";
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options";
import { enqueueCheckout } from "@/app/pos/local/outbox";
import { drainPosOutbox } from "@/app/pos/local/sync-engine";
import { getPosDb } from "@/app/pos/local/db";
import { useSite } from "@/app/context/SiteContext";
import { normalizePrintersSettings, ticketBrandFromSite } from "@/lib/printer";
import { printAfterPosCheckout, receiptFromPosCart } from "@/app/pos/print-after-checkout";
import type { PosShippingAddress } from "@/app/pos/shipping-address";

type Payment = {
  method: string;
  amount: number;
  tendered: number;
  change: number;
};

type UsePosCheckoutArgs = {
  siteId?: string;
  userId?: string;
  cart: PosCartItem[];
  total: number;
  leadValue: RelationSelectValue | string | null;
  leadRelationValue: RelationSelectValue;
  fulfillment: CheckoutFulfillmentMethod;
  originLocationId: string;
  priceListId: string;
  promoCode: string;
  appliedPromo?: {
    promotionId: string;
    code: string | null;
    byConditions: boolean;
  } | null;
  activeOrderId: string;
  buyerUserId: string | null;
  orderNotes?: string;
  shippingAddress?: PosShippingAddress;
  onCleared: () => void;
  appliedPromoRequiresLead?: boolean;
  onRequireLead?: (reason: "checkout" | "send") => void;
  t: (key: string) => string;
  subtotal?: number;
  taxTotal?: number;
};

export function usePosCheckout({
  siteId,
  userId,
  cart,
  total,
  leadValue,
  leadRelationValue,
  fulfillment,
  originLocationId,
  priceListId,
  promoCode,
  appliedPromo = null,
  activeOrderId,
  buyerUserId,
  orderNotes = "",
  shippingAddress,
  onCleared,
  appliedPromoRequiresLead = false,
  onRequireLead,
  t,
  subtotal,
  taxTotal,
}: UsePosCheckoutArgs) {
  const { currentSite } = useSite();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const applyCheckoutGate = (
    leadReason: "checkout" | "send",
    opts?: { customerConfirmed?: boolean; leadOverride?: RelationSelectValue },
  ) => {
    const gate = getPosCheckoutGate({
      cart,
      originLocationId,
      fulfillment,
      leadValue: opts?.leadOverride ?? leadValue,
      buyerUserId,
      shippingAddress,
      appliedPromoRequiresLead,
      customerConfirmed: opts?.customerConfirmed,
    });
    if (gate.ok) return true;
    if (gate.kind === "reservation-lead" || gate.kind === "promo-lead") {
      onRequireLead?.(leadReason);
      return false;
    }
    const messages: Record<string, [string, string]> = {
      origin: ["pos.errorSelectOrigin", "Select an origin location"],
      "ship-customer": [
        "pos.errorSelectCustomerShipping",
        "Select a customer for shipping",
      ],
      "ship-address": [
        "pos.errorShippingAddress",
        "Please enter a complete shipping address",
      ],
      "digital-buyer": [
        "pos.digital.requireBuyer",
        "Select a buyer account for digital items",
      ],
    };
    const msg = messages[gate.kind];
    if (msg) toast.error(t(msg[0]) || msg[1]);
    return false;
  };

  const initiateCheckout = (opts?: { customerConfirmed?: boolean }) => {
    const activeCartItems = cart.filter((c) => c.cartQty > 0);
    if (activeCartItems.length === 0) return;
    if (!applyCheckoutGate("checkout", opts)) return;
    setIsPaymentDialogOpen(true);
  };

  const buildLines = (): CheckoutLine[] =>
    cart
      .filter((c) => c.cartQty > 0)
      .map((c) => ({
        catalogItemId: c.id,
        quantity: c.cartQty,
        unitPriceOverride: c.cartPrice,
        reservationStart: c.reservationStart,
        reservationEnd: c.reservationEnd,
        clientLineKey: c.lineKey || c.id,
        modifiers: (c.modifiers || []).map((m) => ({
          catalogItemId: m.catalogItemId,
          quantity: m.cartQty,
          unitPriceOverride: m.cartPrice,
          groupId: m.groupId,
        })),
      }));

  const enqueueAndFinishCheckout = async (params: {
    payments: Payment[];
    intent: "complete" | "pay" | "send";
    promo?: string;
    resolvedLeadId?: string | null;
    localLeadId?: string | null;
  }) => {
    if (!siteId || !userId) return;

    const clientMutationId = uuidv4();
    const existingIsLocal =
      activeOrderId !== "new" && activeOrderId.startsWith("local_");

    await enqueueCheckout(siteId, {
      siteId,
      userId,
      lines: buildLines(),
      priceListId:
        priceListId && priceListId !== "none" ? priceListId : undefined,
      leadId: params.resolvedLeadId || undefined,
      localLeadId: params.localLeadId || undefined,
      buyerUserId: buyerUserId || undefined,
      fulfillment,
      originLocationId,
      shippingAddress:
        fulfillment === "ship" ? shippingAddress : undefined,
      promotionCode:
        params.promo ||
        appliedPromo?.code ||
        promoCode ||
        undefined,
      // Always send the applied promo id so automatic (no-code) BOGO/condition
      // promos are stored on the order. A typed payment-dialog code wins.
      promotionId: params.promo
        ? undefined
        : appliedPromo?.promotionId || undefined,
      source: "pos",
      payments: params.payments,
      existingOrderId:
        activeOrderId !== "new" && !existingIsLocal
          ? activeOrderId
          : existingIsLocal
            ? activeOrderId
            : undefined,
      intent: params.intent,
      notes: orderNotes.trim(),
      clientMutationId,
    });

    const totalPaid = params.payments.reduce((sum, p) => sum + p.amount, 0);
    const amountDue = roundMoney(Math.max(0, total - totalPaid));
    const db = getPosDb();
    if (activeOrderId !== "new") {
      await db.pendingOrders.delete(activeOrderId);
    }
    if (amountDue > 0) {
      const status = params.intent === "complete" ? "completed" : "pending";
      const id =
        activeOrderId !== "new" ? activeOrderId : `local_${clientMutationId}`;
      const createdAt = new Date().toISOString();
      await db.pendingOrders.put({
        id,
        site_id: siteId,
        status,
        created_at: createdAt,
        lead_id: params.resolvedLeadId || null,
        price_list_id: priceListId !== "none" ? priceListId : null,
        amount_due: amountDue,
        payment_status: "unpaid",
        raw: {
          id,
          status,
          created_at: createdAt,
          leads: null,
          amount_due: amountDue,
          payment_status: "unpaid",
          client_mutation_id: clientMutationId,
          pending_sync: true,
        },
      });
    }

    onCleared();
    setIsPaymentDialogOpen(false);

    toast.success(
      params.intent === "send"
        ? t("pos.orderSent") || "Order sent to orders panel!"
        : t("pos.checkoutComplete") || "Checkout complete!",
    );

    const receipt = receiptFromPosCart({
      cart,
      total,
      payments: params.payments,
      notes: orderNotes,
      brand: ticketBrandFromSite(currentSite),
      customerName: leadRelationValue?.label || null,
      fulfillment,
      currency: currentSite?.settings?.currency || "USD",
      subtotal,
      taxTotal,
    });
    const printersSettings = normalizePrintersSettings(currentSite?.settings?.printers);

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void drainPosOutbox(siteId).then(async () => {
        const row = await getPosDb()
          .outbox.where("clientMutationId")
          .equals(clientMutationId)
          .first();
        if (row?.status === "synced") {
          try {
            await printAfterPosCheckout({
              settings: printersSettings,
              siteId,
              intent: params.intent,
              orderId: row.resultOrderId,
              orderNumber: row.resultOrderNumber,
              kitchenDelta: row.resultKitchenDelta,
              fulfillment: row.resultFulfillment,
              receipt,
            });
          } catch (err) {
            console.warn("[printer] POS print failed", err);
          }
        } else if (row?.status === "failed") {
          toast.error(
            row.lastError ||
              t("pos.sync.failed") ||
              "Sale queued but sync failed. Check sync issues.",
          );
        } else {
          toast.message(
            t("pos.sync.pendingSale") ||
              "Sale saved locally. Syncing when online…",
          );
        }
      });
    } else {
      toast.message(
        t("pos.sync.pendingSale") ||
          "Sale saved locally. Syncing when online…",
      );
    }
  };

  const handleCheckout = async (
    payments: Payment[],
    checkoutPromoCode?: string,
    intent?: "complete" | "pay" | "send",
  ) => {
    if (!siteId || !userId) return;

    const resolvedIntent = intent || "pay";
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = roundMoney(total - totalPaid);
    const requiresCustomer =
      resolvedIntent === "complete" && remainingAmount > 0;

    if (resolvedIntent === "send" && payments.length === 0) {
      // send-order from toolbar uses empty payments; payment dialog send requires payments
      // Keep dialog validation for send-with-payments path only when payments expected.
    }

    if (requiresCustomer && !leadValue) {
      toast.error(
        t("pos.errorSelectCustomerUnpaid") ||
          "Select a customer to leave payment pending",
      );
      setIsPaymentDialogOpen(false);
      return;
    }

    if (!applyCheckoutGate("checkout")) {
      setIsPaymentDialogOpen(false);
      return;
    }

    setCheckoutLoading(true);
    try {
      let resolvedLeadId: string | null = null;
      let localLeadId: string | null = null;

      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (
        leadRelationValue &&
        typeof leadRelationValue === "object" &&
        leadRelationValue.mode === "existing" &&
        leadRelationValue.id?.startsWith("local_")
      ) {
        localLeadId = leadRelationValue.id;
      } else if (online && leadRelationValue) {
        const { id, error: leadError } = await resolveRelationId(
          "lead",
          leadRelationValue,
          siteId,
        );
        if (leadError) throw new Error(`Lead error: ${leadError}`);
        resolvedLeadId = id;
      } else if (
        leadRelationValue &&
        typeof leadRelationValue === "object" &&
        leadRelationValue.mode === "existing"
      ) {
        resolvedLeadId = leadRelationValue.id;
      }

      if (requiresCustomer && !resolvedLeadId && !localLeadId) {
        toast.error(
          t("pos.errorSelectCustomerUnpaid") ||
            "Select a customer to leave payment pending",
        );
        setIsPaymentDialogOpen(false);
        return;
      }

      await enqueueAndFinishCheckout({
        payments,
        intent: resolvedIntent,
        promo: checkoutPromoCode,
        resolvedLeadId,
        localLeadId,
      });
    } catch (err: any) {
      toast.error(
        err.message || t("pos.errorCheckingOut") || "Error checking out",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSendOrder = useCallback(async (opts?: {
    customerConfirmed?: boolean;
    leadOverride?: RelationSelectValue;
  }) => {
    const activeItems = cart.filter((c) => c.cartQty > 0);
    if (activeItems.length === 0) {
      toast.error(t("pos.errorCartEmpty") || "Cart is empty");
      return;
    }
    if (!applyCheckoutGate("send", opts)) return;
    const effectiveLeadRelation = opts?.leadOverride ?? leadRelationValue;
    if (!siteId || !userId) return;

    setCheckoutLoading(true);
    try {
      let resolvedLeadId: string | null = null;
      let localLeadId: string | null = null;
      const online = typeof navigator === "undefined" ? true : navigator.onLine;

      if (
        effectiveLeadRelation &&
        typeof effectiveLeadRelation === "object" &&
        effectiveLeadRelation.mode === "existing" &&
        effectiveLeadRelation.id?.startsWith("local_")
      ) {
        localLeadId = effectiveLeadRelation.id;
      } else if (online && effectiveLeadRelation) {
        const { id, error: leadError } = await resolveRelationId(
          "lead",
          effectiveLeadRelation,
          siteId,
        );
        if (leadError) throw new Error(`Lead error: ${leadError}`);
        resolvedLeadId = id;
      } else if (
        effectiveLeadRelation &&
        typeof effectiveLeadRelation === "object" &&
        effectiveLeadRelation.mode === "existing"
      ) {
        resolvedLeadId = effectiveLeadRelation.id;
      }

      await enqueueAndFinishCheckout({
        payments: [],
        intent: "send",
        resolvedLeadId,
        localLeadId,
      });
    } catch (err: any) {
      toast.error(
        err.message || t("pos.errorSendingOrder") || "Error sending order",
      );
    } finally {
      setCheckoutLoading(false);
    }
    // enqueueAndFinishCheckout closes over latest cart/session fields via render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    originLocationId,
    fulfillment,
    leadValue,
    siteId,
    userId,
    leadRelationValue,
    appliedPromoRequiresLead,
    onRequireLead,
    buyerUserId,
    shippingAddress,
    t,
  ]);

  const createPendingSplitOrders = async (
    ordersToCreate: { title: string; items: PosCartItem[] }[]
  ) => {
    if (!siteId || !userId) return;

    let resolvedLeadId: string | null = null;
    let localLeadId: string | null = null;

    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (
      leadRelationValue &&
      typeof leadRelationValue === "object" &&
      leadRelationValue.mode === "existing" &&
      leadRelationValue.id?.startsWith("local_")
    ) {
      localLeadId = leadRelationValue.id;
    } else if (online && leadRelationValue) {
      const { id, error: leadError } = await resolveRelationId(
        "lead",
        leadRelationValue,
        siteId,
      );
      if (!leadError) resolvedLeadId = id;
    } else if (
      leadRelationValue &&
      typeof leadRelationValue === "object" &&
      leadRelationValue.mode === "existing"
    ) {
      resolvedLeadId = leadRelationValue.id;
    }

    const db = getPosDb();

    for (const order of ordersToCreate) {
      const clientMutationId = uuidv4();
      
      const lines = order.items
        .filter((c) => c.cartQty > 0)
        .map((c) => ({
          catalogItemId: c.id,
          quantity: c.cartQty,
          unitPriceOverride: c.cartPrice,
          reservationStart: c.reservationStart,
          reservationEnd: c.reservationEnd,
          clientLineKey: c.lineKey || c.id,
          modifiers: (c.modifiers || []).map((m) => ({
            catalogItemId: m.catalogItemId,
            quantity: m.cartQty,
            unitPriceOverride: m.cartPrice,
            groupId: m.groupId,
          })),
        }));

      await enqueueCheckout(siteId, {
        siteId,
        userId,
        lines,
        priceListId: priceListId && priceListId !== "none" ? priceListId : undefined,
        leadId: resolvedLeadId || undefined,
        localLeadId: localLeadId || undefined,
        buyerUserId: buyerUserId || undefined,
        fulfillment,
        originLocationId,
        shippingAddress: fulfillment === "ship" ? shippingAddress : undefined,
        promotionCode: appliedPromo?.code || promoCode || undefined,
        promotionId: appliedPromo?.promotionId || undefined,
        source: "pos",
        payments: [],
        intent: "send",
        notes: order.title.trim(),
        clientMutationId,
      });

      // Calculate amount due for this split
      const subtotalSplit = order.items.reduce(
        (sum, item) =>
          sum + (item.cartPrice + (item.modifiers || []).reduce((s, m) => s + m.cartPrice * m.cartQty, 0)) * item.cartQty,
        0,
      );
      // For split orders we use simplified tax/shipping approximation, or 0, since they'll be recalculated on sync.
      // But we can approximate to just subtotal if we don't have taxesByItem here.
      const amountDue = roundMoney(Math.max(0, subtotalSplit)); 

      const id = `local_${clientMutationId}`;
      const createdAt = new Date().toISOString();
      await db.pendingOrders.put({
        id,
        site_id: siteId,
        status: "pending",
        created_at: createdAt,
        lead_id: resolvedLeadId || null,
        price_list_id: priceListId !== "none" ? priceListId : null,
        amount_due: amountDue,
        payment_status: "unpaid",
        raw: {
          id,
          status: "pending",
          created_at: createdAt,
          leads: null,
          amount_due: amountDue,
          payment_status: "unpaid",
          client_mutation_id: clientMutationId,
          pending_sync: true,
        },
      });
    }

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void drainPosOutbox(siteId);
    }
  };

  return {
    checkoutLoading,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    initiateCheckout,
    handleCheckout,
    handleSendOrder,
    createPendingSplitOrders,
  };
}
