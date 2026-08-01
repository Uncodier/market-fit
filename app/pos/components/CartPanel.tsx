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
import {
  RelationSelect,
  RelationSelectValue,
} from "@/app/components/ui/relation-select";
import { EmptyCard } from "@/app/components/ui/empty-card";
import {
  Store,
  X,
  Plus,
  Minus,
  CreditCard,
  ShoppingCart,
  Tag,
  PlusCircle,
} from "@/app/components/ui/icons";
import { resolveItemImage } from "@/app/lib/image-utils";
import { NumpadPanel } from "./NumpadPanel";
import { cn } from "@/lib/utils";

export interface PosCartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number;
  reservationStart?: string;
  reservationEnd?: string;
}

interface CartPanelProps {
  cart: PosCartItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  updateQty: (id: string, delta: number) => void;
  setItemQty: (id: string, qty: number) => void;
  setItemPrice: (id: string, price: number) => void;
  selectedCartItemId: string | null;
  setSelectedCartItemId: (id: string | null) => void;
  leadValue: RelationSelectValue;
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
  t: (key: string) => string;
}

export function CartPanel({
  cart,
  subtotal,
  taxTotal,
  total,
  updateQty,
  setItemQty,
  setItemPrice,
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
  t,
}: CartPanelProps) {
  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {isMobile && (
        <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />{" "}
            {t("pos.cart.currentOrder") || "Current Order"}
          </h2>
          {closeCart && (
            <Button
              variant="ghost"
              size="icon"
              onClick={closeCart}
              className="md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}

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
            {cart.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-0 pr-3 rounded-lg border shadow-sm h-14 cursor-pointer transition-all",
                  selectedCartItemId === item.id
                    ? "bg-primary/10 dark:bg-primary/20"
                    : "bg-card hover:border-primary/50",
                )}
                onClick={() => setSelectedCartItemId?.(item.id)}
              >
                <div className="h-full aspect-square rounded-l-lg bg-muted/30 overflow-hidden flex-shrink-0">
                  <img
                    src={resolveItemImage(item)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-foreground truncate">
                    {item.name}
                  </h4>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {money(item.cartPrice)}
                  </div>
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 rounded-full"
                    onClick={() => updateQty(item.id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-4 text-center text-sm font-medium">
                    {item.cartQty}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 rounded-full"
                    onClick={() => updateQty(item.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
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
            <div className="space-y-1.5 pb-2 border-b mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                {getTrans("pos.cart.currentOrder", "Current Order")}
              </label>
              <RelationSelect
                options={pendingOrders.map((o: any) => {
                  const timeString = new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                  }).format(new Date(o.created_at));
                  return {
                    id: o.id,
                    label: `${getTrans("pos.order", "Order")} - ${timeString}`,
                  };
                })}
                value={
                  activeOrderId === "new"
                    ? null
                    : {
                        mode: "existing",
                        id: activeOrderId,
                        label: (() => {
                          const order = pendingOrders.find(
                            (o: any) => o.id === activeOrderId,
                          );
                          if (order?.created_at) {
                            return `${getTrans("pos.order", "Order")} - ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric" }).format(new Date(order.created_at))}`;
                          }
                          return getTrans("pos.order", "Order");
                        })(),
                      }
                }
                onValueChange={(val) =>
                  handleOrderSelect(
                    val?.mode === "create" || !val ? "new" : val.id,
                  )
                }
                placeholder={getTrans("pos.newOrder", "New Order")}
                searchPlaceholder={getTrans(
                  "pos.searchOrder",
                  "Search order...",
                )}
                emptyMessage={getTrans(
                  "pos.noPendingOrders",
                  "No pending orders",
                )}
                allowCreate={true}
                createLabel={(q) => `New Order`}
                clearable={true}
              />
            </div>

            <RelationSelect
              options={leads.map((l) => {
                const parts = [l.name, l.email, l.phone].filter(Boolean);
                const label = parts.length > 0 ? parts.join(" · ") : t("pos.cart.customer") || "Customer";
                const searchText = [l.name, l.email, l.personal_email, l.phone].filter(Boolean).join(" ");
                return {
                  id: l.id,
                  label,
                  searchText,
                };
              })}
              value={leadValue}
              onValueChange={setLeadValue}
              placeholder={t("pos.cart.walkIn") || "Walk-in Customer"}
              searchPlaceholder={t("pos.cart.searchCustomer") || "Search by name, email, or phone..."}
              emptyMessage={t("pos.cart.noCustomers") || "No customers found"}
            />

            <Select
              value={fulfillment}
              onValueChange={(val: any) => setFulfillment(val)}
            >
              <SelectTrigger className="bg-card">
                <SelectValue
                  placeholder={t("pos.cart.fulfillment") || "Fulfillment"}
                />
              </SelectTrigger>
              <SelectContent>
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
                {allowedFulfillments.includes("dine_in") && (
                  <SelectItem value="dine_in">
                    {t("pos.cart.fulfillments.dineIn") || "Dine In"}
                  </SelectItem>
                )}
                {allowedFulfillments.includes("ship") && (
                  <SelectItem value="ship">
                    {t("pos.cart.fulfillments.ship") || "Ship to Customer"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {fulfillment !== "none" && (
              <Select
                value={originLocationId}
                onValueChange={setOriginLocationId}
              >
                <SelectTrigger className="bg-card">
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
            )}

            {priceLists && priceLists.length > 0 && (
              <Select value={priceListId} onValueChange={handlePriceListChange}>
                <SelectTrigger className="bg-card">
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
            )}

            <div className="space-y-1.5 pt-1">
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("pos.cart.promoCode") || "Promo code..."}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="uppercase pl-9 bg-card"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="numpad" className="mt-0">
            <NumpadPanel
              selectedCartItemId={selectedCartItemId}
              cart={cart}
              setItemQty={setItemQty}
              setItemPrice={setItemPrice}
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
          <Button
            className="w-full h-12 text-lg mt-4"
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
  );
}
