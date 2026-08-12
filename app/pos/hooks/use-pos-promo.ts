"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  findMatchingConditionPromotionLocal,
  resolvePromotionDiscountLocal,
  type LocalPromoLine,
  type LocalPromoMatch,
} from "@/app/pos/local/resolve-promo-local";
import type { LocalPromotion } from "@/app/pos/local/types";
import type { PosCartItem } from "@/app/pos/components/CartPanel";

export type AppliedPosPromo = LocalPromoMatch;

type UsePosPromoArgs = {
  cart: PosCartItem[];
  promotions: LocalPromotion[];
  originLocationId: string;
  siteTimezone?: string | null;
  t: (key: string) => string;
};

export function usePosPromo({
  cart,
  promotions,
  originLocationId,
  siteTimezone = null,
  t,
}: UsePosPromoArgs) {
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPosPromo | null>(
    null,
  );

  const promoLines = useMemo((): LocalPromoLine[] => {
    return cart
      .filter((c) => c.cartQty > 0)
      .map((c) => {
        const extras = (c.modifiers || []).reduce(
          (sum, m) => sum + m.cartPrice * m.cartQty,
          0,
        );
        return {
          catalogItemId: c.id,
          categoryId: c.category_id,
          subtotal: (c.cartPrice + extras) * c.cartQty,
          quantity: c.cartQty,
        };
      });
  }, [cart]);

  // Keep applied promo in sync with cart; auto-apply codeless condition promos
  useEffect(() => {
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
        current &&
        current.promotionId === match.promotionId &&
        current.discount === match.discount
      ) {
        return current;
      }
      return match;
    });
  }, [promoLines, promotions, originLocationId, siteTimezone, promoCode]);

  const clearAppliedPromo = useCallback(() => {
    setAppliedPromo(null);
  }, []);

  const resetPromo = useCallback(() => {
    setPromoCode("");
    setAppliedPromo(null);
  }, []);

  const validatePromotion = useCallback(() => {
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
      setPromoCode(res.data.code || trimmed.toUpperCase());
      setAppliedPromo(res.data);
      toast.success(t("pos.cart.promoApplied") || "Promotion applied");
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
    setAppliedPromo(match);
    toast.success(t("pos.cart.promoApplied") || "Promotion applied");
  }, [
    promoLines,
    promoCode,
    promotions,
    originLocationId,
    siteTimezone,
    t,
  ]);

  return {
    promoCode,
    setPromoCode,
    appliedPromo,
    promoDiscount: appliedPromo?.discount ?? 0,
    validatePromotion,
    clearAppliedPromo,
    resetPromo,
    /** Used when hydrating cart session */
    hydratePromoCode: setPromoCode,
  };
}
