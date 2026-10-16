import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PosOrderSeller } from "@/app/pos/order-snapshot";

type SellerIdentityRow = { name?: string | null; email?: string | null };
type SellerMemberRow = SellerIdentityRow & { user_id: string };
type SellerProfileRow = SellerIdentityRow & { id: string };

function displayName(row: SellerIdentityRow): string | undefined {
  return row.name?.trim() || row.email?.trim() || undefined;
}

/** Enrich retained sellers using only the already-authorized user's RLS client. */
export async function enrichPosOrderSellers<T extends { seller_user_id?: string | null }>(
  supabase: Pick<SupabaseClient, "from">,
  siteId: string,
  orders: T[],
): Promise<Array<T & { seller?: PosOrderSeller }>> {
  const sellerIds = [...new Set(orders.map((order) => order.seller_user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (sellerIds.length === 0) return orders;

  const sellers = new Map<string, PosOrderSeller>();
  try {
    const { data, error } = await supabase
      .from("site_members")
      .select("user_id, name, email")
      .eq("site_id", siteId)
      .in("user_id", sellerIds);
    if (!error) {
      for (const member of (data || []) as SellerMemberRow[]) {
        const name = displayName(member);
        if (sellerIds.includes(member.user_id) && name) {
          sellers.set(member.user_id, { id: member.user_id, name });
        }
      }
    }
  } catch {
    // Optional display enrichment must not prevent loading the order.
  }

  const unresolvedIds = sellerIds.filter((id) => !sellers.has(id));
  if (unresolvedIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", unresolvedIds);
      if (!error) {
        for (const profile of (data || []) as SellerProfileRow[]) {
          const name = displayName(profile);
          if (unresolvedIds.includes(profile.id) && name) {
            sellers.set(profile.id, { id: profile.id, name });
          }
        }
      }
    } catch {
      // Keep the retained seller ID even when its display identity is unavailable.
    }
  }

  return orders.map((order) => order.seller_user_id ? {
    ...order,
    seller: sellers.get(order.seller_user_id) || {
      id: order.seller_user_id,
      name: "Seller unavailable",
    },
  } : order);
}