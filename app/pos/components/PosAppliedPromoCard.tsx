"use client";

import { Button } from "@/app/components/ui/button";
import { Tag, X } from "@/app/components/ui/icons";
import type { LocalPromoMatch } from "@/app/pos/local/resolve-promo-local";
import { resolvePromotionImage } from "@/app/lib/image-utils";
import { cn } from "@/lib/utils";

type PosAppliedPromoCardProps = {
  promo: LocalPromoMatch;
  money: (amount: number) => string;
  onClear: () => void;
  label: (key: string, fallback: string) => string;
};

export function PosAppliedPromoCard({
  promo,
  money,
  onClear,
  label,
}: PosAppliedPromoCardProps) {
  const subtitle = promo.byConditions
    ? label("pos.cart.promoByConditions", "Applied by order conditions")
    : promo.code
      ? `${label("pos.cart.promoCodeLabel", "Code")}: ${promo.code}`
      : label("pos.cart.promoApplied", "Promotion applied");

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-0 pr-3 rounded-lg border shadow-sm h-14",
        "border-green-500/30 bg-green-500/10",
      )}
    >
      <div className="h-full aspect-square rounded-l-lg bg-green-500/15 overflow-hidden flex-shrink-0">
        <img
          src={resolvePromotionImage({
            image_url: promo.imageUrl,
            name: promo.promotionName,
          })}
          alt={promo.promotionName}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.opacity = "0";
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-foreground truncate">
          {promo.promotionName}
        </h4>
        <div className="text-muted-foreground text-xs mt-0.5 truncate flex items-center gap-1">
          <Tag className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{subtitle}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
          −{money(promo.discount)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          aria-label={label("pos.cart.clearPromo", "Clear promo")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
