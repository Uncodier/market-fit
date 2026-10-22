export type PosCheckoutRecoveryState = "rejected" | "payment_recorded" | "review_required";

export type PosCheckoutRecovery = {
  state: "completed" | "not_found" | "processing" | PosCheckoutRecoveryState;
  message: string;
  orderId?: string | null;
  saleId?: string | null;
  result?: {
    success: true;
    saleId: string;
    orderId: string;
    orderNumber?: string | null;
    kitchenDelta?: import("@/lib/printer/core/types").KitchenDelta | null;
    fulfillment?: string | null;
  };
};

export class PosCheckoutRecoveryError extends Error {
  constructor(public readonly recovery: PosCheckoutRecovery) {
    super(recovery.message);
  }
}