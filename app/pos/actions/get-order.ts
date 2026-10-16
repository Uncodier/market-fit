"use server";

import { z } from "zod";
import { enrichPosOrderSellers } from "@/app/pos/order-seller";
import {
  normalizePosOrderLead,
  POS_ORDER_READ_SELECT,
  type PosOrderSnapshot,
} from "@/app/pos/order-snapshot";
import { requirePosSiteAccess } from "./site-access";

const orderRequestSchema = z.object({
  siteId: z.string().uuid(),
  orderId: z.string().uuid(),
});

/** Load only the data needed to restore a POS order session. */
export async function getPosOrder(siteId: string, orderId: string): Promise<
  { data: PosOrderSnapshot; error?: never } | { data?: never; error: string }
> {
  const parsed = orderRequestSchema.safeParse({ siteId, orderId });
  if (!parsed.success) return { error: "Invalid POS order request" };

  try {
    const access = await requirePosSiteAccess(parsed.data.siteId);
    if ("error" in access) return { error: access.error || "Forbidden" };

    const { data, error } = await access.supabase
      .from("sale_orders")
      .select(POS_ORDER_READ_SELECT)
      .eq("site_id", parsed.data.siteId)
      .eq("id", parsed.data.orderId)
      .single();

    if (error || !data) return { error: "Unable to load POS order" };
    const [order] = await enrichPosOrderSellers(
      access.supabase,
      parsed.data.siteId,
      [normalizePosOrderLead(data as PosOrderSnapshot)],
    );
    return { data: order };
  } catch {
    return { error: "Unable to load POS order" };
  }
}