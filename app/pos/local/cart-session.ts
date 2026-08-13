import { getPosDb } from "./db";
import type { PosCartSession } from "./types";
import {
  clearActivePosOrderId,
  getActivePosOrderId,
} from "@/app/pos/active-order-storage";
import { EMPTY_POS_SHIPPING_ADDRESS } from "@/app/pos/shipping-address";

const DEFAULT_SESSION = (
  siteId: string,
): Omit<PosCartSession, "updatedAt"> => ({
  siteId,
  cart: [],
  leadValue: null,
  fulfillment: "dine_in",
  originLocationId: "",
  priceListId: "none",
  promoCode: "",
  activeOrderId: "new",
  buyerUserId: null,
  orderNotes: "",
  shippingAddress: EMPTY_POS_SHIPPING_ADDRESS,
});

export async function loadCartSession(
  siteId: string,
): Promise<PosCartSession> {
  const db = getPosDb();
  const existing = await db.cartSessions.get(siteId);
  if (existing) return existing;

  // One-time migration from legacy localStorage active order pointer
  const legacyOrderId = getActivePosOrderId(siteId);
  const session: PosCartSession = {
    ...DEFAULT_SESSION(siteId),
    activeOrderId: legacyOrderId || "new",
    updatedAt: new Date().toISOString(),
  };
  await db.cartSessions.put(session);
  if (legacyOrderId) clearActivePosOrderId(siteId);
  return session;
}

export async function saveCartSession(
  session: Omit<PosCartSession, "updatedAt"> & { updatedAt?: string },
): Promise<PosCartSession> {
  const next: PosCartSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  await getPosDb().cartSessions.put(next);
  return next;
}

export async function clearCartSession(siteId: string): Promise<PosCartSession> {
  return saveCartSession(DEFAULT_SESSION(siteId));
}
