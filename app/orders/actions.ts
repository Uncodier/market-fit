"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OrderParams, OrderWithRelations } from "./types";
import { SaleOrderData } from "@/app/types";

export async function listOrders({ siteId, status, q, locationId, page = 1, pageSize = 50 }: OrderParams) {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("sale_orders")
      .select(`
        *,
        fulfillment_method,
        sale_order_items (status),
        sales (
          status,
          source,
          amount,
          payment_method,
          amount_due,
          leads (id, name, email)
        )
      `, { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (status && status !== 'all') {
      if (status.includes(',')) {
        query = query.in("status", status.split(','));
      } else {
        query = query.eq("status", status);
      }
    }
    if (locationId && locationId !== 'all') {
      query = query.eq("origin_location_id", locationId);
    }
    if (q) {
      query = query.ilike("order_number", `%${q}%`);
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
      sales (status, source, amount, payment_method, amount_due),
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

  return { data: data as any as OrderWithRelations };
}

export async function updateOrderStatus(siteId: string, orderId: string, status: string) {
  try {
    const supabase = await createClient();
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
