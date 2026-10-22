"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OrderParams, OrderWithRelations } from "./types";
import { listOrdersCached } from "./list-orders-cache";
import { SaleOrderData } from "@/app/types";
import { shouldCancelLinkedSale } from "./cancel-linked-sale";
import { grantFromOrder } from "@/app/commerce/entitlements";
import { revokeOrderFulfillment } from "@/app/commerce/order-fulfillment-sync";
import { assertInternalOrder } from "@/lib/marketplace/mutation-guards";
import { assertSelfServiceFulfillmentPaid } from "@/app/commerce/self-service-fulfillment-guard";
import {
  bumpCacheEpoch,
} from "@/lib/redis/json-cache";

export async function listOrders(params: OrderParams) {
  return listOrdersCached(params)
}

async function invalidateOrderCaches(siteId: string) {
  await bumpCacheEpoch("order-data", siteId)
}

export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sale_orders")
    .select(`
      *,
      sales (status, source, amount, payment_method, amount_due, payments),
      shipments (id, status, tracking_number, carrier, metadata),
      price_lists (name),
      promotions (name, code),
      sale_order_items (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error in getOrder:", error);
    return { error: error.message };
  }
  
  // also fetch lead through sale
  if (data?.sale_id) {
    const { data: saleData } = await supabase
      .from("sales")
      .select(`
        leads (id, name, email, phone)
      `)
      .eq("id", data.sale_id)
      .single();
    if (saleData?.leads) {
      data.leads = saleData.leads;
    }
  }

  const attributionUserIds = [
    ...new Set(
      [data?.created_by_user_id, data?.seller_user_id].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  if (data?.site_id && attributionUserIds.length > 0) {
    const { data: members } = await supabase
      .from("site_members")
      .select("user_id, name, email")
      .eq("site_id", data.site_id)
      .in("user_id", attributionUserIds);
    const byUserId = new Map(
      (members || []).map((member: { user_id: string; name: string | null; email: string | null }) => [
        member.user_id,
        {
          id: member.user_id,
          name: member.name,
          email: member.email,
        },
      ]),
    );
    const unresolvedUserIds = attributionUserIds.filter(
      (userId) => !byUserId.has(userId),
    );
    if (unresolvedUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", unresolvedUserIds);
      for (const profile of profiles || []) {
        byUserId.set(profile.id, profile);
      }
    }
    data.created_by =
      byUserId.get(data.created_by_user_id) || null;
    data.seller = byUserId.get(data.seller_user_id) || null;
  }
  if (data?.requested_by_lead_id) {
    const { data: requestor } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("site_id", data.site_id)
      .eq("id", data.requested_by_lead_id)
      .maybeSingle();
    data.requested_by = requestor || null;
  }

  return { data: data as OrderWithRelations };
}

export async function updateOrderStatus(siteId: string, orderId: string, status: string) {
  if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
    return { error: "Invalid order status" }
  }
  try {
    const supabase = await createClient();
    await assertSelfServiceFulfillmentPaid(supabase, siteId, orderId, status);

    const { data: currentOrder, error: fetchError } = await supabase
      .from("sale_orders")
      .select("id, status, sale_id, metadata")
      .eq("site_id", siteId)
      .eq("id", orderId)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    if (currentOrder?.metadata?.marketplace) {
      return { error: "Use the marketplace order actions to update this order" };
    }
    if (currentOrder?.status === "cancelled" && status !== "cancelled") {
      return { error: "Cancelled orders cannot be reopened" }
    }

    const { data, error } = await supabase
      .from("sale_orders")
      .update({ status })
      .eq("site_id", siteId)
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (status === 'completed') {
      if (currentOrder?.sale_id) {
        const { data: paidSale } = await supabase
          .from("sales")
          .select("id, status, amount_due")
          .eq("id", currentOrder.sale_id)
          .eq("site_id", siteId)
          .single();

        if (paidSale?.status === "pending" && Number(paidSale.amount_due) === 0) {
          await supabase
            .from("sales")
            .update({ status: "completed" })
            .eq("id", paidSale.id)
            .eq("site_id", siteId);
        }

        if (Number(paidSale?.amount_due) === 0) {
          await grantFromOrder(orderId, true);
        }
      }
    }

    if (status === "cancelled") {
      await revokeOrderFulfillment(supabase, orderId, {
        previousStatus: currentOrder?.status,
      });

      if (currentOrder?.sale_id) {
        const { data: sale } = await supabase
          .from("sales")
          .select("id, status, payments, amount, amount_due")
          .eq("id", currentOrder.sale_id)
          .eq("site_id", siteId)
          .single();

        if (sale && shouldCancelLinkedSale(currentOrder.status, sale)) {
          await supabase
            .from("sales")
            .update({ status: "cancelled" })
            .eq("id", sale.id)
            .eq("site_id", siteId);
          revalidatePath("/sales");
          revalidatePath(`/sales/${sale.id}`);
        }
      }
    }

    await invalidateOrderCaches(siteId);
    revalidatePath(`/orders`);
    revalidatePath(`/orders/${orderId}`);
    return { data: data as SaleOrderData };
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    return { error: error instanceof Error ? error.message : "Failed to update order status" };
  }
}

export async function updateOrderItemStatus(siteId: string, itemId: string, orderId: string, status: string) {
  try {
    const supabase = await createClient();
    await assertInternalOrder(supabase, siteId, orderId);
    await assertSelfServiceFulfillmentPaid(supabase, siteId, orderId, status);
    const { error } = await supabase
      .from("sale_order_items")
      .update({ status })
      .eq("site_id", siteId)
      .eq("sale_order_id", orderId)
      .eq("id", itemId);

    if (error) throw new Error(error.message);
    await invalidateOrderCaches(siteId);
    revalidatePath(`/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error("Error in updateOrderItemStatus:", error);
    return { error: error instanceof Error ? error.message : "Failed to update order item" };
  }
}

export async function updateOrderItemsStatus(
  siteId: string,
  orderId: string,
  status: string,
) {
  const allowedStatuses = new Set([
    "draft",
    "new",
    "preparing",
    "completed",
    "returned",
    "cancelled",
  ])
  if (!allowedStatuses.has(status)) return { error: "Invalid item status" }

  try {
    const supabase = await createClient()
    await assertInternalOrder(supabase, siteId, orderId)
    await assertSelfServiceFulfillmentPaid(supabase, siteId, orderId, status)
    const { error } = await supabase
      .from("sale_order_items")
      .update({ status })
      .eq("site_id", siteId)
      .eq("sale_order_id", orderId)

    if (error) throw new Error(error.message)
    await invalidateOrderCaches(siteId)
    revalidatePath("/order-lines")
    revalidatePath(`/orders/${orderId}`)
    return { success: true }
  } catch (error) {
    console.error("Error in updateOrderItemsStatus:", error)
    return { error: error instanceof Error ? error.message : "Failed to update order items" }
  }
}

export async function updateOrderNotes(siteId: string, orderId: string, notes: string) {
  try {
    const supabase = await createClient();
    await assertInternalOrder(supabase, siteId, orderId);
    const { data, error } = await supabase
      .from("sale_orders")
      .update({ notes })
      .eq("site_id", siteId)
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    await invalidateOrderCaches(siteId);
    revalidatePath(`/orders`);
    revalidatePath(`/orders/${orderId}`);
    return { data: data as SaleOrderData };
  } catch (error) {
    console.error("Error in updateOrderNotes:", error);
    return { error: error instanceof Error ? error.message : "Failed to update order notes" };
  }
}
