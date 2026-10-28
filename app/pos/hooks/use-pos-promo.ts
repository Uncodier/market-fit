"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  findMatchingConditionPromotionLocal,
  promotionRequiresIdentifiableBuyer,
  resolvePromotionDiscountLocal,
  type LocalPromoLine,
  type LocalPromoMatch,
} from "@/app/pos/local/resolve-promo-local";
import type { LocalPromotion } from "@/app/pos/local/types";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import { posCartLineSubtotal } from "@/app/pos/cart-totals";
import { posPromoCartFingerprint } from "@/app/pos/recorded-order-promo";

export type AppliedPosPromo = LocalPromoMatch;

type UsePosPromoArgs = {
  cart: PosCartItem[];
  promotions: LocalPromotion[];
  originLocationId: string;
  siteTimezone?: string | null;
  hasLead?: boolean;
  onRequireLead?: () => void;
  t: (key: string) => string;
  siteCurrency?: string;
  fxRates?: Record<string, number>;
  orderContext?: string;
};

export function usePosPromo({
  cart,
  promotions,
  originLocationId,
  siteTimezone = null,
  hasLead = false,
  onRequireLead,
  t,
  siteCurrency = "USD",
  fxRates = {},
  orderContext = "",
}: UsePosPromoArgs) {
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPosPromo | null>(
    null,
  );
  const [recordedOrderPromo, setRecordedOrderPromo] = useState<AppliedPosPromo | null>(null);
  const [recordedPromoFingerprint, setRecordedPromoFingerprint] = useState<string | null>(null);

  const hydrateRecordedOrderPromo = useCallback((promo: AppliedPosPromo | null, fingerprint: string | null = null) => {
    setRecordedOrderPromo(promo);
    setRecordedPromoFingerprint(fingerprint);
    setPromoCode(promo?.code || "");
    setAppliedPromo(promo);
  }, []);
  const changePromoCode = useCallback((code: string) => {
    if (recordedOrderPromo) {
      toast.error("Change the recorded promotion in Orders, then reload this order before payment.");
      return;
    }
    setRecordedOrderPromo(null);
    setPromoCode(code);
    setAppliedPromo(null);
  }, [recordedOrderPromo]);

  const promoLines = useMemo((): LocalPromoLine[] => {
    return cart
      .filter((c) => c.cartQty > 0)
      .map((c) => {
        return {
          catalogItemId: c.id,
          categoryId: c.category_id,
          subtotal: posCartLineSubtotal(c, siteCurrency, fxRates),
          quantity: c.cartQty,
        };
      });
  }, [cart, siteCurrency, fxRates]);

  const applyMatch = useCallback(
    (match: LocalPromoMatch, leadPresent: boolean): boolean => {
      if (
        promotionRequiresIdentifiableBuyer(match.usageLimitPerUser) &&
        !leadPresent
      ) {
        if (onRequireLead) {
          onRequireLead();
        } else {
          toast.error(
            t("pos.cart.requireLeadTitle") ||
              "Promotion requires an identifiable buyer",
          );
        }
        return false;
      }
      setPromoCode(match.code || "");
      setAppliedPromo(match);
      toast.success(t("pos.cart.promoApplied") || "Promotion applied");
      return true;
    },
    [onRequireLead, t],
  );

  // Keep applied promo in sync with cart; auto-apply codeless condition promos
  useEffect(() => {
    // Shop-only, expired or exhausted coupons remain a recorded order discount.
    // They are not a fresh POS redemption; the server verifies payment eligibility.
    if (recordedOrderPromo) return;
    if (promoLines.length === 0) {
      setAppliedPromo(null);
      return;
    }

    setAppliedPromo((current) => {
      // Re-validate a coupon-code promo
      if (current?.code) {
        const res = resolvePromotionDiscountLocal({
          code: current.code,
          promotions,
          lines: promoLines,
          locationId: originLocationId || null,
          timezone: siteTimezone,
        });
        if ("error" in res) return null;
        if (
          promotionRequiresIdentifiableBuyer(res.data.usageLimitPerUser) &&
          !hasLead
        ) {
          return null;
        }
        if (
          res.data.discount === current.discount &&
          res.data.promotionId === current.promotionId
        ) {
          return current;
        }
        return res.data;
      }

      // While the cashier is typing a code, do not auto-apply
      if (promoCode.trim()) {
        if (current && !current.code) return null;
        return current;
      }

      // Auto / re-validate best matching condition-based (no-code) promo
      const match = findMatchingConditionPromotionLocal({
        promotions,
        lines: promoLines,
        locationId: originLocationId || null,
        timezone: siteTimezone,
      });

      if (!match) return null;
      if (
        promotionRequiresIdentifiableBuyer(match.usageLimitPerUser) &&
        !hasLead
      ) {
        return null;
      }
      if (
        current &&
        current.promotionId === match.promotionId &&
        current.discount === match.discount
      ) {
        return current;
      }
      return match;
    });
  }, [
    promoLines,
    promotions,
    originLocationId,
    siteTimezone,
    promoCode,
    hasLead,
    recordedOrderPromo,
  ]);

  const clearAppliedPromo = useCallback(() => {
    if (recordedOrderPromo) {
      toast.error("Change the recorded promotion in Orders, then reload this order before payment.");
      return;
    }
    setRecordedOrderPromo(null);
    setAppliedPromo(null);
    setPromoCode("");
  }, [recordedOrderPromo]);

  const resetPromo = useCallback(() => {
    setRecordedOrderPromo(null);
    setRecordedPromoFingerprint(null);
    setPromoCode("");
    setAppliedPromo(null);
  }, []);

  const validatePromotion = useCallback(
    (opts?: { leadPresent?: boolean }) => {
      if (recordedOrderPromo) return;
      setRecordedOrderPromo(null);
      const leadPresent = opts?.leadPresent ?? hasLead;
      if (promoLines.length === 0) {
        toast.error(t("pos.errorCartEmpty") || "Cart is empty");
        return;
      }

      const trimmed = promoCode.trim();
      if (trimmed) {
        const res = resolvePromotionDiscountLocal({
          code: trimmed,
          promotions,
          lines: promoLines,
          locationId: originLocationId || null,
          timezone: siteTimezone,
        });
        if ("error" in res) {
          setAppliedPromo(null);
          toast.error(res.error);
          return;
        }
        applyMatch(res.data, leadPresent);
        return;
      }

      const match = findMatchingConditionPromotionLocal({
        promotions,
        lines: promoLines,
        locationId: originLocationId || null,
        timezone: siteTimezone,
      });
      if (!match) {
        setAppliedPromo(null);
        toast.error(
          t("pos.cart.noMatchingPromo") ||
            "No matching promotion for this order",
        );
        return;
      }
      applyMatch(match, leadPresent);
    },
    [
      promoLines,
      promoCode,
      promotions,
      originLocationId,
      siteTimezone,
      hasLead,
      applyMatch,
      t,
      recordedOrderPromo,
    ],
  );

  const appliedPromoRequiresLead = promotionRequiresIdentifiableBuyer(
    appliedPromo?.usageLimitPerUser,
  );

  return {
    promoCode,
    setPromoCode: changePromoCode,
    appliedPromo,
    promoDiscount: appliedPromo?.discount ?? 0,
    appliedPromoRequiresLead,
    validatePromotion,
    clearAppliedPromo,
    resetPromo,
    recordedOrderPromo,
    recordedPromoFingerprint,
    recordedPromoNeedsReview: !!recordedOrderPromo &&
      posPromoCartFingerprint(cart, orderContext) !== recordedPromoFingerprint,
    hydrateRecordedOrderPromo,
    /** Used when hydrating cart session */
    hydratePromoCode: setPromoCode,
  };
}
