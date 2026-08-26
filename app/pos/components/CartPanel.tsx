"use client";

import { CatalogItem } from "@/app/types";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/app/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { EmptyCard } from "@/app/components/ui/empty-card";
import {
  X,
  CreditCard,
  ShoppingCart,
  Tag,
  Store,
  MapPin,
  DollarSign,
  SplitSquareHorizontal,
} from "@/app/components/ui/icons";
import { NumpadPanel } from "./NumpadPanel";
import { PosCustomerSelect } from "./PosCustomerSelect";
import { PosOrderSelect } from "./PosOrderSelect";
import { PosOrderNotesField } from "./PosOrderNotesField";
import { PosAppliedPromoCard } from "./PosAppliedPromoCard";
import { PosCartLines } from "./PosCartLines";
import { PosShippingAddressFields } from "./PosShippingAddressFields";
import { cn } from "@/lib/utils";
import type { LocalPromoMatch } from "@/app/pos/local/resolve-promo-local";
import type { PosShippingAddress } from "@/app/pos/shipping-address";
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export interface PosCartModifier {
  groupId: string;
  catalogItemId: string;
  name: string;
  cartQty: number;
  cartPrice: number;
}

export interface PosCartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number;
  /** Unit price before a cashier line discount. */
  cartListPrice?: number;
  /** Percent off cartListPrice (0–100). */
  cartDiscountPercent?: number;
  /** Stable cart line identity (host + modifiers). */
  lineKey?: string;
  modifiers?: PosCartModifier[];
  reservationStart?: string;
  reservationEnd?: string;
  reservationAvailableQty?: number;
}

interface CartPanelProps {
  cart: PosCartItem[];
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  updateQty: (id: string, delta: number) => void;
  setItemQty: (id: string, qty: number) => void;
  setItemPrice: (id: string, price: number) => void;
  setItemDiscount: (id: string, percent: number) => void;
  selectedCartItemId: string | null;
  setSelectedCartItemId: (id: string | null) => void;
  leadValue: RelationSelectValue | string;
  setLeadValue: (value: RelationSelectValue) => void;
  fulfillment: "pickup" | "ship" | "dine_in" | "none";
  setFulfillment: (value: "pickup" | "ship" | "dine_in" | "none") => void;
  originLocationId: string;
  setOriginLocationId: (value: string) => void;
  priceListId: string;
  handlePriceListChange: (value: string) => void;
  priceLists: any[];
  promoCode: string;
  setPromoCode: (value: string) => void;
  appliedPromo: LocalPromoMatch | null;
  promoDiscount: number;
  validatePromotion: () => void;
  clearAppliedPromo: () => void;
  handleCheckout: () => void;
  checkoutLoading: boolean;
  leads: any[];
  locations: any[];
  isMobile?: boolean;
  closeCart?: () => void;
  activeOrderId: string;
  pendingOrders: any[];
  handleOrderSelect: (val: string) => void;
  allowedFulfillments?: ("pickup" | "ship" | "dine_in" | "none")[];
  orderNotes?: string;
  setOrderNotes?: (value: string) => void;
  siteId?: string;
  onLeadUpdated?: (lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
  shippingAddress?: PosShippingAddress;
  setShippingAddress?: (value: PosShippingAddress) => void;
  onSplitBill?: () => void;
  t: (key: string) => string;
  siteCurrency?: string;
}

export function CartPanel({
  cart,
  subtotal,
  taxTotal,
  shippingTotal,
  total,
  updateQty,
  setItemQty,
  setItemPrice,
  setItemDiscount,
  selectedCartItemId,
  setSelectedCartItemId,
  leadValue,
  setLeadValue,
  fulfillment,
  setFulfillment,
  originLocationId,
  setOriginLocationId,
  priceListId,
  handlePriceListChange,
  priceLists,
  promoCode,
  setPromoCode,
  appliedPromo,
  promoDiscount,
  validatePromotion,
  clearAppliedPromo,
  handleCheckout,
  checkoutLoading,
  leads,
  locations,
  isMobile,
  closeCart,
  activeOrderId,
  pendingOrders,
  handleOrderSelect,
  allowedFulfillments = ["pickup", "ship", "dine_in", "none"],
  orderNotes = "",
  setOrderNotes,
  siteId,
  onLeadUpdated,
  shippingAddress,
  setShippingAddress,
  onSplitBill,
  t,
  siteCurrency = "USD",
}: CartPanelProps) {
  const { formatPrice } = useDisplayCurrency();
  const money = (amount: number) => formatPrice(amount, siteCurrency);

  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className={cn(
          "sticky top-0 z-20 flex items-center gap-2 min-h-[71px] px-4 flex-shrink-0",
          "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          "border-b dark:border-white/5 border-black/5",
        )}
      >
        <div className="flex-1 min-w-0">
          <PosOrderSelect
            pendingOrders={pendingOrders}
            activeOrderId={activeOrderId}
            orderNotes={orderNotes}
            onOrderSelect={handleOrderSelect}
            t={t}
            className="bg-card"
          />
        </div>
        {isMobile && closeCart && (
          <Button
            variant="ghost"
            size="icon"
            onClick={closeCart}
            className="md:hidden flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {cart.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyCard
              variant="fancy"
              showShadow={false}
              icon={<ShoppingCart className="w-8 h-8 text-muted-foreground" />}
              title={t("pos.cart.empty.title") || "Current Order is empty"}
              description={
                t("pos.cart.empty.desc") ||
                "Add items from the catalog to start a new order."
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            <PosCartLines
              cart={cart}
              selectedCartItemId={selectedCartItemId}
              setSelectedCartItemId={setSelectedCartItemId}
              updateQty={updateQty}
            />

            {appliedPromo && (
              <PosAppliedPromoCard
                promo={appliedPromo}
                money={money}
                onClear={clearAppliedPromo}
                label={getTrans}
              />
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-muted/30 border-t space-y-4 flex-shrink-0">
        <Tabs defaultValue="numpad" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="options">
              {getTrans("pos.cart.options", "Options")}
            </TabsTrigger>
            <TabsTrigger value="numpad">
              {getTrans("pos.cart.numpad", "Numpad")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="options" className="space-y-3 mt-0">
            <PosCustomerSelect
              leads={leads}
              leadValue={leadValue}
              setLeadValue={setLeadValue}
              siteId={siteId}
              onLeadUpdated={onLeadUpdated}
              t={t}
            />

            {setOrderNotes && (
              <PosOrderNotesField
                notes={orderNotes}
                setNotes={setOrderNotes}
                t={t}
              />
            )}

            <div className="relative">
              <Store className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Select
                value={fulfillment}
                onValueChange={(val: any) => setFulfillment(val)}
                disabled={allowedFulfillments.length <= 1}
              >
                <SelectTrigger className="bg-card pl-9">
                  <SelectValue
                    placeholder={t("pos.cart.fulfillment") || "Fulfillment"}
                  />
                </SelectTrigger>
              <SelectContent>
                {allowedFulfillments.includes("dine_in") && (
                  <SelectItem value="dine_in">
                    {t("consumeHere") || "Consume Here"}
                  </SelectItem>
                )}
                {allowedFulfillments.includes("none") && (
                  <SelectItem value="none">
                    {t("pos.cart.fulfillments.carryOut") || "Carry Out / Walk-in"}
                  </SelectItem>
                )}
                {allowedFulfillments.includes("pickup") && (
                  <SelectItem value="pickup">
                    {t("pos.cart.fulfillments.pickup") || "Store Pickup"}
                  </SelectItem>
                )}
                {allowedFulfillments.includes("ship") && (
                  <SelectItem value="ship">
                    {t("pos.cart.fulfillments.ship") || "Ship to Customer"}
                  </SelectItem>
                )}
              </SelectContent>
              </Select>
            </div>

            {fulfillment === "ship" && shippingAddress && setShippingAddress && (
              <PosShippingAddressFields
                value={shippingAddress}
                onChange={setShippingAddress}
                t={t}
              />
            )}

            {fulfillment !== "none" && locations.length > 1 && (
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Select
                  value={originLocationId}
                  onValueChange={setOriginLocationId}
                >
                  <SelectTrigger className="bg-card pl-9">
                    <SelectValue
                      placeholder={
                        fulfillment === "ship"
                          ? t("pos.cart.shipFrom") || "Ship From Location"
                          : t("pos.cart.originLocation") || "Origin Location"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {t("pos.cart.from") || "From"}: {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {priceLists && priceLists.length > 1 && (
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Select value={priceListId} onValueChange={handlePriceListChange}>
                  <SelectTrigger className="bg-card pl-9">
                    <SelectValue
                      placeholder={t("pos.cart.priceList") || "Price List"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("pos.cart.defaultPrices") || "Default Prices"}
                    </SelectItem>
                    {priceLists.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>
                        {pl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t("pos.cart.promoCode") || "Promo code..."}
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    if (appliedPromo?.code) clearAppliedPromo();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      validatePromotion();
                    }
                  }}
                  className="uppercase pl-9 pr-28 bg-card"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={validatePromotion}
                    className="h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    {getTrans("pos.cart.validatePromo", "Validate")}
                  </button>
                </div>
              </div>
            </div>

            {onSplitBill && (
              <div className="pt-2">
                <Button
                  variant="secondary"
                  className="w-full justify-center text-muted-foreground font-medium"
                  disabled={cart.length === 0}
                  onClick={onSplitBill}
                >
                  <SplitSquareHorizontal className="h-4 w-4 mr-2" />
                  {getTrans("pos.cart.splitTitle", "Split Bill")}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="numpad" className="mt-0">
            <NumpadPanel
              selectedCartItemId={selectedCartItemId}
              setItemQty={setItemQty}
              setItemPrice={setItemPrice}
              setItemDiscount={setItemDiscount}
              t={t}
            />
          </TabsContent>
        </Tabs>

        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {t("pos.cart.subtotal") || "Subtotal"}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {money(subtotal)}
            </span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t("pos.cart.discount") || "Discount"}
              </span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                −{money(promoDiscount)}
              </span>
            </div>
          )}
          {taxTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t("pos.cart.tax") || "Tax"}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {money(taxTotal)}
              </span>
            </div>
          )}
          {fulfillment === 'ship' && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t("pos.cart.shipping") || "Shipping"}
              </span>
              <span className={cn("text-sm font-medium", shippingTotal === 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                {shippingTotal === 0 ? (t("pos.cart.free") || "Free") : money(shippingTotal)}
              </span>
            </div>
          )}
          <div className="flex mt-4">
            <Button
              className="flex-1 h-12 text-lg"
              disabled={cart.length === 0 || checkoutLoading}
              onClick={handleCheckout}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {checkoutLoading
                ? t("pos.cart.processing") || "Processing..."
                : `${t("pos.cart.charge") || "Charge"} ${money(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
