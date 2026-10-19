import { Button } from "@/app/components/ui/button";
import { CreditCard } from "@/app/components/ui/icons";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  subtotal: number;
  promoDiscount: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  fulfillment: string;
  cartLength: number;
  activeOrderId: string;
  checkoutLoading: boolean;
  orderPreparing: boolean;
  handleCheckout: () => void;
  money: (amount: number) => string;
  t: (key: string) => string;
};

export function PosCartSummary({
  subtotal, promoDiscount, taxTotal, shippingTotal, total, fulfillment,
  cartLength, activeOrderId, checkoutLoading, orderPreparing, handleCheckout, money, t,
}: Props) {
  const label = (key: string, fallback: string) => t(key) === key ? fallback : t(key);

  return (
    <div className="pt-4 border-t border-border space-y-2">
      {orderPreparing ? (
        <div role="status" aria-label="Loading order totals" className="flex justify-between items-center">
          <span className="sr-only">Loading order totals</span>
          <Skeleton aria-hidden="true" className="h-4 w-20" />
          <Skeleton aria-hidden="true" className="h-4 w-16" />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{t("pos.cart.subtotal") || "Subtotal"}</span>
            <span className="text-sm font-medium text-muted-foreground">{money(subtotal)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t("pos.cart.discount") || "Discount"}</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">−{money(promoDiscount)}</span>
            </div>
          )}
          {taxTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t("pos.cart.tax") || "Tax"}</span>
              <span className="text-sm font-medium text-muted-foreground">{money(taxTotal)}</span>
            </div>
          )}
          {fulfillment === "ship" && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t("pos.cart.shipping") || "Shipping"}</span>
              <span className={cn("text-sm font-medium", shippingTotal === 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                {shippingTotal === 0 ? (t("pos.cart.free") || "Free") : money(shippingTotal)}
              </span>
            </div>
          )}
        </>
      )}
      <div className="flex mt-4">
        <Button className="flex-1 h-12 text-lg" disabled={(cartLength === 0 && activeOrderId === "new") || checkoutLoading} onClick={handleCheckout}>
          <CreditCard className="h-5 w-5 mr-2" />
          {checkoutLoading
            ? t("pos.cart.processing") || "Processing..."
            : orderPreparing ? label("pos.cart.charge", "Charge")
            : `${t("pos.cart.charge") || "Charge"} ${money(total)}`}
        </Button>
      </div>
    </div>
  );
}