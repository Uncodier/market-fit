import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderParams, OrderWithRelations } from "./types";

export async function queryOrders({ siteId, status, paymentStatus, q, locationId, page = 1, pageSize = 50, startDate, endDate, sort }: OrderParams) {
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
    
    const selectString = `
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
    const rows = (data || []).map((row: { sales?: { leads?: OrderWithRelations["leads"] } }) => ({
      ...row,
      leads: row.sales?.leads || null,
    })) as OrderWithRelations[];

    return { data: rows, count: count || 0 };
  } catch (error) {
    console.error("Error in listOrders:", error);
    return { data: [], count: 0, error: error instanceof Error ? error.message : "Failed to load orders" };
  }
}

