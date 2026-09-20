"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OrderParams, OrderWithRelations } from "./types";
import { SaleOrderData } from "@/app/types";
import { shouldCancelLinkedSale } from "./cancel-linked-sale";
import { grantFromOrder } from "@/app/commerce/entitlements";
import { revokeOrderFulfillment } from "@/app/commerce/order-fulfillment-sync";

export async function listOrders({ siteId, status, paymentStatus, q, locationId, page = 1, pageSize = 50, startDate, endDate, sort }: OrderParams) {
  try {
    const supabase = await createClient();
    const searchQuery = q?.trim();
    let matchingOrderIds: string[] | null = null;

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      const [numberMatches, productMatches] = await Promise.all([
        supabase
          .from("sale_orders")
          .select("id")
          .eq("site_id", siteId)
          .ilike("order_number", searchPattern)
          .limit(5000),
        supabase
          .from("sale_order_items")
          .select("sale_order_id")
          .eq("site_id", siteId)
          .ilike("name", searchPattern)
          .limit(5000),
      ]);

      if (numberMatches.error) throw new Error(numberMatches.error.message);
      if (productMatches.error) throw new Error(productMatches.error.message);

      matchingOrderIds = [
        ...new Set([
          ...(numberMatches.data || []).map(
            (row: { id: string }) => row.id,
          ),
          ...(productMatches.data || []).map(
            (row: { sale_order_id: string | null }) => row.sale_order_id,
          ),
        ]),
      ].filter((id): id is string => Boolean(id));

      if (matchingOrderIds.length === 0) {
        return { data: [], count: 0 };
      }
    }
    
    let selectString = `
        *,
        fulfillment_method,
        sale_order_items (
          id,
          status,
          name,
          quantity,
          catalog_item_id,
          parent_sale_order_item_id,
          metadata
        ),
        sales${paymentStatus === 'unpaid' ? '!inner' : ''} (
          status,
          source,
          amount,
          payment_method,
          amount_due,
          payments,
          leads (id, name, email)
        )
      `;

    let query = supabase
      .from("sale_orders")
      .select(selectString, { count: "exact" })
      .eq("site_id", siteId);
      
    if (sort === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else if (sort === "updated_at") {
      query = query.order("updated_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (status && status !== 'all') {
      if (status.includes(',')) {
        query = query.in("status", status.split(','));
      } else {
        query = query.eq("status", status);
      }
    }
    if (paymentStatus === 'unpaid') {
      query = query.gt('sales.amount_due', 0);
    }
    if (locationId && locationId !== 'all') {
      query = query.eq("origin_location_id", locationId);
    }
    if (matchingOrderIds) {
      query = query.in("id", matchingOrderIds);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    // Flatten lead from nested sales.leads for list UI
    const rows = (data || []).map((row: any) => ({
      ...row,
      leads: row.sales?.leads || null,
    })) as OrderWithRelations[];

    return { data: rows, count: count || 0 };
  } catch (error: any) {
    console.error("Error in listOrders:", error);
    return { data: [], count: 0, error: error.message };
  }
}

export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sale_orders")
    .select(`
      *,
      sales (status, source, amount, payment_method, amount_due, payments),
      shipments (id, status, tracking_number, carrier),
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
      (data as any).leads = saleData.leads;
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
      (members || []).map((member: any) => [
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
    (data as any).created_by =
      byUserId.get(data.created_by_user_id) || null;
    (data as any).seller = byUserId.get(data.seller_user_id) || null;
  }
  if (data?.requested_by_lead_id) {
    const { data: requestor } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("site_id", data.site_id)
      .eq("id", data.requested_by_lead_id)
      .maybeSingle();
    (data as any).requested_by = requestor || null;
  }

  return { data: data as any as OrderWithRelations };
}

export async function updateOrderStatus(siteId: string, orderId: string, status: string) {
  try {
    const supabase = await createClient();

    const { data: currentOrder, error: fetchError } = await supabase
      .from("sale_orders")
      .select("id, status, sale_id")
      .eq("site_id", siteId)
      .eq("id", orderId)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { data, error } = await supabase
      .from("sale_orders")
      .update({ status })
      .eq("site_id", siteId)
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (status === 'completed') {
      await supabase
        .from("sale_order_items")
        .update({ status: 'completed' })
        .eq("sale_order_id", orderId);

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

    revalidatePath(`/orders`);
    revalidatePath(`/orders/${orderId}`);
    return { data: data as SaleOrderData };
  } catch (error: any) {
    console.error("Error in updateOrderStatus:", error);
    return { error: error.message };
  }
}

export async function updateOrderItemStatus(siteId: string, itemId: string, orderId: string, status: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("sale_order_items")
      .update({ status })
      .eq("site_id", siteId)
      .eq("id", itemId);

    if (error) throw new Error(error.message);
    revalidatePath(`/orders/${orderId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateOrderItemStatus:", error);
    return { error: error.message };
  }
}

export async function updateOrderNotes(siteId: string, orderId: string, notes: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sale_orders")
      .update({ notes })
      .eq("site_id", siteId)
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/orders`);
    revalidatePath(`/orders/${orderId}`);
    return { data: data as SaleOrderData };
  } catch (error: any) {
    console.error("Error in updateOrderNotes:", error);
    return { error: error.message };
  }
}
