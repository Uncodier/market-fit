"use client";

import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { resolveRelationId } from "@/app/commerce/resolve-relation";
import { roundMoney } from "@/app/commerce/taxes";
import type { CheckoutLine } from "@/app/commerce/checkout";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options";
import { enqueueCheckout } from "@/app/pos/local/outbox";
import { drainPosOutbox } from "@/app/pos/local/sync-engine";
import { getPosDb } from "@/app/pos/local/db";
import { navigateToOrder, navigateToSale } from "@/app/hooks/use-navigation-history";

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
  router: { push: (href: string) => void };
  onCleared: () => void;
  t: (key: string) => string;
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
  router,
  onCleared,
  t,
}: UsePosCheckoutArgs) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const initiateCheckout = () => {
    const activeCartItems = cart.filter((c) => c.cartQty > 0);
    if (activeCartItems.length === 0) return;
    if (!originLocationId) {
      toast.error(t("pos.errorSelectOrigin") || "Select an origin location");
      return;
    }
    if (fulfillment === "ship" && !leadValue) {
      toast.error(
        t("pos.errorSelectCustomerShipping") ||
          "Select a customer for shipping",
      );
      return;
    }
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

  const enqueueAndMaybeNavigate = async (params: {
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
      promotionCode:
        params.promo ||
        appliedPromo?.code ||
        promoCode ||
        undefined,
      promotionId:
        params.promo || appliedPromo?.code || promoCode
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

    // Optimistic local pending order marker for UX
    await getPosDb().pendingOrders.put({
      id: `local_${clientMutationId}`,
      site_id: siteId,
      status: params.intent === "send" ? "pending" : "completed",
      created_at: new Date().toISOString(),
      lead_id: params.resolvedLeadId || null,
      price_list_id: priceListId !== "none" ? priceListId : null,
      payment_status: params.intent === "pay" || params.intent === "complete"
        ? "paid"
        : "unpaid",
      raw: {
        id: `local_${clientMutationId}`,
        status: params.intent === "send" ? "pending" : "completed",
        created_at: new Date().toISOString(),
        leads: null,
        client_mutation_id: clientMutationId,
        pending_sync: true,
      },
    });

    onCleared();
    setIsPaymentDialogOpen(false);

    toast.success(
      params.intent === "send"
        ? t("pos.orderSent") || "Order sent to orders panel!"
        : t("pos.checkoutComplete") || "Checkout complete!",
    );

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void drainPosOutbox(siteId).then(async () => {
        const row = await getPosDb()
          .outbox.where("clientMutationId")
          .equals(clientMutationId)
          .first();
        if (row?.status === "synced") {
          if (params.intent === "send" && row.resultOrderId) {
            navigateToOrder({ orderId: row.resultOrderId, router });
          } else if (row.resultSaleId) {
            navigateToSale({ saleId: row.resultSaleId, router });
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

      await enqueueAndMaybeNavigate({
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

  const handleSendOrder = useCallback(async () => {
    const activeItems = cart.filter((c) => c.cartQty > 0);
    if (activeItems.length === 0) {
      toast.error(t("pos.errorCartEmpty") || "Cart is empty");
      return;
    }
    if (!originLocationId) {
      toast.error(t("pos.errorSelectOrigin") || "Select an origin location");
      return;
    }
    if (fulfillment === "ship" && !leadValue) {
      toast.error(
        t("pos.errorSelectCustomerShipping") ||
          "Select a customer for shipping",
      );
      return;
    }
    if (!siteId || !userId) return;

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

      await enqueueAndMaybeNavigate({
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
    // enqueueAndMaybeNavigate closes over latest cart/session fields via render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    originLocationId,
    fulfillment,
    leadValue,
    siteId,
    userId,
    leadRelationValue,
    t,
  ]);

  return {
    checkoutLoading,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    initiateCheckout,
    handleCheckout,
    handleSendOrder,
  };
}
