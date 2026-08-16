"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { upsertPolizaForExpense } from "@/app/accounting/ensure";
import { resolvePromotionDiscount } from "./resolve-promotion";
import { upsertPromotionDiscountExpense } from "./promo-discount-expense";
import { saleAmountsAfterDiscount } from "./sale-amounts-after-discount";

export async function applyPromotionToOrder(
  siteId: string,
  saleOrderId: string,
  promotionCode: string | null | undefined,
  forceServiceRole: boolean = false,
  promotionId?: string | null,
) {
  try {
    const supabase = forceServiceRole
      ? await createServiceClient(true)
      : await createClient();

    const { data: items } = await supabase
      .from("sale_order_items")
      .select("catalog_item_id, subtotal, quantity")
      .eq("sale_order_id", saleOrderId);
    if (!items || items.length === 0) throw new Error("Order has no items");

    const { data: order } = await supabase
      .from("sale_orders")
      .select(
        "id, site_id, sale_id, tax_total, shipping_cost, currency, user_id, buyer_user_id, origin_location_id, promotion_id, sales(source, lead_id, sale_date, user_id, amount, amount_due, payments, status)",
      )
      .eq("id", saleOrderId)
      .single();
    if (!order) throw new Error("Order not found");

    const saleRel = Array.isArray((order as any).sales)
      ? (order as any).sales[0]
      : (order as any).sales;
    const saleSource = saleRel?.source ?? null;
    const saleLeadId = saleRel?.lead_id ?? null;

    const resolved = await resolvePromotionDiscount({
      siteId,
      code: promotionCode,
      promotionId,
      lines: items.map((item: any) => ({
        catalogItemId: item.catalog_item_id,
        subtotal: Number(item.subtotal),
        quantity: Number(item.quantity) || 1,
      })),
      buyerUserId: order.buyer_user_id,
      leadId: saleLeadId,
      source: saleSource,
      locationId: order.origin_location_id || null,
      excludeOrderId: saleOrderId,
      forceServiceRole,
    });

    if ("error" in resolved) throw new Error(resolved.error);

    const { promotionId: resolvedPromoId, discount, orderSubtotal } =
      resolved.data;
    const taxTotal = Number(order.tax_total) || 0;
    const shippingCost = Number((order as { shipping_cost?: number | null }).shipping_cost) || 0;
    const total = Math.max(0, orderSubtotal - discount + taxTotal + shippingCost);

    const { error: updateError } = await supabase
      .from("sale_orders")
      .update({
        promotion_id: resolvedPromoId,
        discount_total: discount,
        total: total,
      })
      .eq("id", saleOrderId);

    if (updateError) throw new Error(updateError.message);

    const { data: promo } = await supabase
      .from("promotions")
      .select("usage_count, campaign_id, code, name")
      .eq("id", resolvedPromoId)
      .single();

    const { count: usageCount, error: usageCountError } = await supabase
      .from("sale_orders")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", resolvedPromoId)
      .not("status", "in", "(cancelled,canceled)");
    if (usageCountError) throw new Error(usageCountError.message);

    const { error: usageError } = await supabase
      .from("promotions")
      .update({ usage_count: usageCount ?? 0 })
      .eq("id", resolvedPromoId);
    if (usageError) throw new Error(usageError.message);

    const campaignId = promo?.campaign_id || null;
    if (order.sale_id) {
      const saleUpdate: Record<string, unknown> = {
        ...saleAmountsAfterDiscount(total, saleRel),
      };
      if (campaignId) saleUpdate.campaign_id = campaignId;
      await supabase.from("sales").update(saleUpdate).eq("id", order.sale_id);
    }
    if (campaignId && saleLeadId) {
      await supabase
        .from("leads")
        .update({ campaign_id: campaignId })
        .eq("id", saleLeadId);
    }

    if (discount > 0) {
      const expenseDate =
        (saleRel?.sale_date as string | undefined) ||
        new Date().toLocaleDateString("en-CA");
      let expenseUserId: string | null =
        order.user_id || saleRel?.user_id || null;

      if (!expenseUserId) {
        const { data: site } = await supabase
          .from("sites")
          .select("user_id")
          .eq("id", order.site_id || siteId)
          .maybeSingle();
        expenseUserId = site?.user_id || null;
      }

      const expenseClient = await createServiceClient(true);
      
      try {
        await upsertPromotionDiscountExpense({
          supabase: expenseClient,
          siteId: order.site_id || siteId,
          saleOrderId,
          discount,
          campaignId,
          leadId: saleLeadId,
          locationId: order.origin_location_id || null,
          userId: expenseUserId,
          currency: order.currency || "USD",
          date: expenseDate,
          promotionCode: promo?.code || promotionCode,
          promotionName: promo?.name,
        });

        const { data: promoExpense } = await expenseClient
          .from("transactions")
          .select("id")
          .eq("sale_order_id", saleOrderId)
          .eq("category", "promotions")
          .maybeSingle();
        if (promoExpense?.id) {
          await upsertPolizaForExpense(promoExpense.id, order.site_id || siteId);
        }
      } catch (error) {
        console.error("[accounting] Failed to post promotion expense:", error);
      }
    }

    return { success: true, discount, total };
  } catch (error: any) {
    return { error: error.message };
  }
}
