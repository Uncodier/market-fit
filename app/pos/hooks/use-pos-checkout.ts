"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Payment, UsePosCheckoutArgs } from "./pos-checkout-types";
import { getPosPermissionLease, isPosPermissionCurrent } from "../local/location-permission-state";
import { useCheckoutAttempt } from "./use-checkout-attempt";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { roundMoney } from "@/app/commerce/taxes";
import { posCheckoutLines } from "@/app/pos/checkout-lines";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import { getPosCheckoutGate } from "@/app/pos/checkout-gates";
import {
  enqueueCreateLead,
} from "@/app/pos/local/outbox";
import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { drainPosOutbox, refreshPosSyncCounts } from "@/app/pos/local/sync-engine";
import { getPosDb } from "@/app/pos/local/db";
import { useSite } from "@/app/context/SiteContext";
import { normalizePrintersSettings, ticketBrandFromSite } from "@/lib/printer";
import { printAfterPosCheckout, receiptFromPosCart } from "@/app/pos/print-after-checkout";
import { createPendingSplitOrders as enqueuePendingSplitOrders } from "@/app/pos/create-pending-split-orders";
import { planPosLeadSync } from "@/app/pos/lead-utils";
import { checkOrderBeforePayment, PosOrderChangedError } from "@/app/pos/check-order-before-payment";

export function usePosCheckout({
  validateInventory,
  siteId,
  userId,
  sellerUserId,
  sellerName,
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
  orderPreparing = false,
  expectedOrderVersion,
  onOrderChanged,
  existingPaymentTotal = 0,
  buyerUserId,
  orderNotes = "",
  shippingAddress,
  onCleared,
  appliedPromoRequiresLead = false,
  onRequireLead,
  t,
  subtotal,
  taxTotal,
  currency,
}: UsePosCheckoutArgs) {
  const { currentSite } = useSite();
  const permission = getPosPermissionLease(siteId);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const checkoutAttempt = useCheckoutAttempt(siteId, userId);
  const [paymentOrder, setPaymentOrder] = useState<{ siteId?: string; id: string } | null>(null);
  const isPaymentDialogOpen = paymentOrder?.siteId === siteId && paymentOrder?.id === activeOrderId;
  const setIsPaymentDialogOpen = (open: boolean) => setPaymentOrder(open ? { siteId, id: activeOrderId } : null);
  const submitting = useRef(false);
  const cartKey = JSON.stringify(posCheckoutLines(cart));
  const selection = useRef({ siteId, userId, activeOrderId, cartKey });
  useLayoutEffect(() => {
    selection.current = { siteId, userId, activeOrderId, cartKey };
    return () => { selection.current = { siteId: undefined, userId: undefined, activeOrderId: "new", cartKey: "" }; };
  }, [siteId, userId, activeOrderId, cartKey]);
  const checkoutGuard = () => {
    const selected = selection.current;
    const session = checkoutAttempt.session();
    return () => isPosPermissionCurrent(permission) && selection.current === selected &&
      selected.siteId === siteId && selected.userId === userId && selected.activeOrderId === activeOrderId &&
      selected.cartKey === cartKey && checkoutAttempt.isCurrent(session);
  };
  const amountDue = roundMoney(Math.max(0, total - existingPaymentTotal));

  const applyCheckoutGate = (
    leadReason: "checkout" | "send",
    opts?: { customerConfirmed?: boolean; leadOverride?: RelationSelectValue },
  ) => {
    if (validateInventory && !validateInventory()) return false;
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
    if (activeOrderId !== "new" && orderPreparing) {
      setIsPaymentDialogOpen(true);
      return;
    }
    const activeCartItems = cart.filter((c) => c.cartQty > 0);
    if (activeCartItems.length === 0) return;
    if (!applyCheckoutGate("checkout", opts)) return;
    setIsPaymentDialogOpen(true);
  };

  const prepareLeadForSync = async (
    value: RelationSelectValue,
  ): Promise<{
    resolvedLeadId: string | null;
    localLeadId: string | null;
  }> => {
    if (!siteId) {
      return { resolvedLeadId: null, localLeadId: null };
    }

    const plan = planPosLeadSync(value, uuidv4);
    if (plan.createLead) {
      await enqueueCreateLead(siteId, {
        siteId,
        ...plan.createLead,
      });
    }

    return {
      resolvedLeadId: plan.resolvedLeadId,
      localLeadId: plan.localLeadId,
    };
  };

  const enqueueAndFinishCheckout = async (params: {
    payments: Payment[];
    intent: "complete" | "pay" | "send";
    promo?: string;
    resolvedLeadId?: string | null;
    localLeadId?: string | null;
  }, isCurrent: () => boolean) => {
    if (!siteId || !userId || !isCurrent()) return;

    let clientMutationId = checkoutAttempt.id([activeOrderId, posCheckoutLines(cart),
      params.payments, params.intent, params.promo, leadRelationValue, fulfillment, originLocationId,
      priceListId, buyerUserId, shippingAddress, appliedPromo, promoCode, orderNotes, sellerUserId]);
    const existingIsLocal =
      activeOrderId !== "new" && activeOrderId.startsWith("local_");

    const queuedCheckout = await enqueueRegisteredCheckout(siteId, {
      siteId,
      userId,
      sellerUserId: sellerUserId || undefined,
      lines: posCheckoutLines(cart),
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
      expectedOrderVersion,
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
    }, (id) => { if (isCurrent()) checkoutAttempt.adopt(id); });
    if (!isCurrent()) return;
    clientMutationId = queuedCheckout.clientMutationId;
    refreshPosSyncCounts(siteId);

    const totalPaid = params.payments.reduce((sum, p) => sum + p.amount, 0);
    const nextAmountDue = roundMoney(
      Math.max(0, amountDue - totalPaid),
    );
    const db = getPosDb();
    if (activeOrderId !== "new") {
      await db.pendingOrders.delete(activeOrderId);
      if (!isCurrent()) return;
    }
    if (nextAmountDue > 0) {
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
        amount_due: nextAmountDue,
        payment_status: "unpaid",
        raw: {
          id,
          status,
          created_at: createdAt,
          leads: null,
          amount_due: nextAmountDue,
          payment_status: "unpaid",
          client_mutation_id: clientMutationId,
          seller_user_id: sellerUserId || userId,
          seller_name: sellerName || null,
          pending_sync: true,
        },
      });
      if (!isCurrent()) return;
    }

    onCleared();
    checkoutAttempt.clear();
    const finishedSelection = selection.current;
    const finishedSession = checkoutAttempt.session();
    const receiptCurrent = () => isPosPermissionCurrent(permission) && checkoutAttempt.isCurrent(finishedSession) &&
      (selection.current === finishedSelection || (selection.current.siteId === siteId &&
        selection.current.userId === userId && selection.current.activeOrderId === "new" && selection.current.cartKey === "[]"));
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
      requestedByName: sellerName || null,
      fulfillment,
      currency: currency || currentSite?.settings?.currency || "USD",
      subtotal,
      taxTotal,
    });
    const printersSettings = normalizePrintersSettings(currentSite?.settings?.printers);

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void drainPosOutbox(siteId).then(async () => {
        if (!receiptCurrent()) return;
        const row = await getPosDb()
          .outbox.where("clientMutationId")
          .equals(clientMutationId)
          .first();
        if (!receiptCurrent()) return;
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
      }).catch(() => undefined);
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
    if (!siteId || !userId || orderPreparing || submitting.current || !isPosPermissionCurrent(permission)) return;
    const isCurrent = checkoutGuard();
    if (!isCurrent()) return;

    const resolvedIntent = intent || "pay";
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = roundMoney(amountDue - totalPaid);
    const requiresCustomer =
      resolvedIntent === "complete" && remainingAmount > 0;

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

    submitting.current = true;
    setCheckoutLoading(true);
    try {
      await checkOrderBeforePayment(siteId, activeOrderId, expectedOrderVersion);
      if (!isCurrent()) return;
      const { resolvedLeadId, localLeadId } =
        await prepareLeadForSync(leadRelationValue);
      if (!isCurrent()) return;

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
      }, isCurrent);
    } catch (err) {
      if (!isCurrent()) return;
      if (err instanceof PosOrderChangedError) {
        setIsPaymentDialogOpen(false);
        onOrderChanged?.(activeOrderId);
      }
      toast.error(
        err instanceof Error ? err.message : t("pos.errorCheckingOut") || "Error checking out",
      );
    } finally {
      submitting.current = false;
      setCheckoutLoading(false);
    }
  };

  const handleSendOrder = useCallback(async (opts?: {
    customerConfirmed?: boolean;
    leadOverride?: RelationSelectValue;
  }) => {
    if (orderPreparing || submitting.current) return;
    const activeItems = cart.filter((c) => c.cartQty > 0);
    if (activeItems.length === 0) {
      toast.error(t("pos.errorCartEmpty") || "Cart is empty");
      return;
    }
    if (!applyCheckoutGate("send", opts)) return;
    const effectiveLeadRelation = opts?.leadOverride ?? leadRelationValue;
    if (!siteId || !userId || !isPosPermissionCurrent(permission)) return;
    const isCurrent = checkoutGuard();
    if (!isCurrent()) return;

    submitting.current = true;
    setCheckoutLoading(true);
    try {
      const { resolvedLeadId, localLeadId } =
        await prepareLeadForSync(effectiveLeadRelation);
      if (!isCurrent()) return;

      await enqueueAndFinishCheckout({
        payments: [],
        intent: "send",
        resolvedLeadId,
        localLeadId,
      }, isCurrent);
    } catch (err) {
      if (!isCurrent()) return;
      toast.error(
        err instanceof Error ? err.message : t("pos.errorSendingOrder") || "Error sending order",
      );
    } finally {
      submitting.current = false;
      setCheckoutLoading(false);
    }
    // enqueueAndFinishCheckout closes over latest cart/session fields via render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    activeOrderId,
    expectedOrderVersion,
    permission,
    orderPreparing,
    originLocationId,
    validateInventory,
    fulfillment,
    leadValue,
    siteId,
    userId,
    sellerUserId,
    sellerName,
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
    if (validateInventory && !validateInventory()) return;
    await enqueuePendingSplitOrders({
      orders: ordersToCreate,
      siteId,
      userId,
      sellerUserId,
      sellerName,
      leadRelationValue,
      priceListId,
      buyerUserId,
      fulfillment,
      originLocationId,
      shippingAddress,
      promotionCode: appliedPromo?.code || promoCode,
      promotionId: appliedPromo?.promotionId,
    });
  };

  return {
    checkoutLoading,
    amountDue,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    initiateCheckout,
    handleCheckout,
    handleSendOrder,
    createPendingSplitOrders,
  };
}
