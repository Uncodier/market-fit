import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options";
import type { PosShippingAddress } from "@/app/pos/shipping-address";

export type Payment = {
  method: string;
  amount: number;
  tendered: number;
  change: number;
};

export type UsePosCheckoutArgs = {
  validateInventory?: () => boolean;
  siteId?: string;
  userId?: string;
  sellerUserId?: string | null;
  sellerName?: string | null;
  cart: PosCartItem[];
  total: number;
  leadValue: RelationSelectValue | string | null;
  leadRelationValue: RelationSelectValue;
  fulfillment: CheckoutFulfillmentMethod;
  originLocationId: string;
  locations?: { id: string }[];
  priceListId: string;
  promoCode: string;
  appliedPromo?: {
    promotionId: string;
    code: string | null;
    byConditions: boolean;
    discount?: number;
    orderSubtotal?: number;
    promotionName?: string;
  } | null;
  activeOrderId: string;
  orderPreparing?: boolean;
  expectedOrderVersion?: string;
  onOrderChanged?: (id: string) => void;
  existingPaymentTotal?: number;
  buyerUserId: string | null;
  orderNotes?: string;
  shippingAddress?: PosShippingAddress;
  onCleared: () => void | Promise<void>;
  appliedPromoRequiresLead?: boolean;
  onRequireLead?: (reason: "checkout" | "send") => void;
  t: (key: string) => string;
  subtotal?: number;
  taxTotal?: number;
  currency?: string | null;
};

