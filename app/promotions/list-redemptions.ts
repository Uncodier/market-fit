"use server";

import { createClient } from "@/lib/supabase/server";
import {
  mapPromotionRedemption,
  type PromotionRedemption,
} from "./redemption-map";

export async function listPromotionRedemptions({
  siteId,
  campaignId,
  promotionId,
  page = 1,
  pageSize = 50,
}: {
  siteId: string;
  campaignId?: string;
  promotionId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: PromotionRedemption[]; count: number; error?: string }> {
  try {
    const supabase = await createClient();

    let promotionIds: string[] = [];
    if (promotionId) {
      promotionIds = [promotionId];
    } else if (campaignId) {
      const { data: promos, error: promoError } = await supabase
        .from("promotions")
        .select("id")
        .eq("site_id", siteId)
        .eq("campaign_id", campaignId);

      if (promoError) throw new Error(promoError.message);
      promotionIds = (promos || []).map((row: { id: string }) => row.id);
    }

    if (promotionIds.length === 0) {
      return { data: [], count: 0 };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabase
      .from("sale_orders")
      .select(
        `
        id,
        order_number,
        created_at,
        discount_total,
        total,
        currency,
        status,
        promotion_id,
        promotions(name, code),
        sales(source, leads(name))
      `,
        { count: "exact" },
      )
      .eq("site_id", siteId)
      .in("promotion_id", promotionIds)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    return {
      data: (data || []).map(mapPromotionRedemption),
      count: count || 0,
    };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}
