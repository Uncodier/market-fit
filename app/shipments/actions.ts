"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ShipmentParams, ShipmentWithRelations } from "./types";
import { Shipment } from "@/app/types";

export async function listShipments({ siteId, status, leadId, q, page = 1, pageSize = 50 }: ShipmentParams) {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from("shipments")
      .select(`
        *,
        leads (name, email),
        sale_orders (order_number, total),
        locations!origin_location_id (name)
      `, { count: "exact" })
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (status && status !== 'all') {
      query = query.eq("status", status);
    }
    if (leadId) {
      query = query.eq("lead_id", leadId);
    }
    if (q) {
      // Search by tracking number or lead name
      query = query.or(`tracking_number.ilike.%${q}%,leads.name.ilike.%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    return { data: data as any[] as ShipmentWithRelations[], count: count || 0 };
  } catch (error: any) {
    return { data: [], count: 0, error: error.message };
  }
}

export async function getShipment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select(`
      *,
      leads (name, email, phone),
      sale_orders (order_number, total, status),
      locations!origin_location_id (name)
    `)
    .eq("id", id)
    .single();

  if (error) return { error: error.message };
  return { data: data as any as ShipmentWithRelations };
}

export async function createShipment(params: {
  siteId: string;
  saleOrderId: string;
  saleId?: string;
  leadId?: string; // made optional
  originLocationId: string;
  shippingAddress?: any;
  carrier?: string;
  userId: string;
  forceServiceRole?: boolean;
}) {
  try {
    const supabase = params.forceServiceRole ? await createServiceClient(true) : await createClient();
    const { data, error } = await supabase
      .from("shipments")
      .insert({
        site_id: params.siteId,
        sale_order_id: params.saleOrderId,
        sale_id: params.saleId,
        lead_id: params.leadId || null, // pass null if undefined
        origin_location_id: params.originLocationId,
        shipping_address: params.shippingAddress,
        carrier: params.carrier,
        user_id: params.userId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/shipments`);
    if (params.saleId) revalidatePath(`/sales/${params.saleId}`);
    return { data: data as Shipment };
  } catch (error: any) {
    return { error: error.message };
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['in_transit', 'delivered', 'failed'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  cancelled: [],
  failed: []
};

export async function updateShipmentStatus(siteId: string, shipmentId: string, newStatus: string) {
  try {
    const supabase = await createClient();
    
    // 1. Get current
    const { data: current } = await supabase.from("shipments").select("status, stock_decremented, sale_order_id, origin_location_id").eq("id", shipmentId).single();
    if (!current) throw new Error("Shipment not found");
    
    // 2. Validate transition
    if (!VALID_TRANSITIONS[current.status]?.includes(newStatus) && current.status !== newStatus) {
      throw new Error(`Invalid transition from ${current.status} to ${newStatus}`);
    }

    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'shipped') updates.shipped_at = new Date().toISOString();
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();

    // 3. Stock Decrement logic
    if ((newStatus === 'shipped' || newStatus === 'delivered') && !current.stock_decremented) {
      // Check commerce settings
      const { data: settings } = await supabase.from("settings").select("commerce").eq("site_id", siteId).single();
      const policy = settings?.commerce?.decrement_stock_on || 'ship';
      
      // Decrement if policy is ship and status is shipped/delivered, OR policy is order_complete and status is delivered
      if ((policy === 'ship' && (newStatus === 'shipped' || newStatus === 'delivered')) || (policy === 'order_complete' && newStatus === 'delivered')) {
        // Need to decrement stock.
        // We need the items from sale_order_items.
        const { data: orderItems } = await supabase
          .from("sale_order_items")
          .select("catalog_item_id, quantity")
          .eq("sale_order_id", current.sale_order_id)
          .not("catalog_item_id", "is", null);

        if (orderItems && orderItems.length > 0) {
          // Decrement each item
          for (const item of orderItems) {
            // Check if track_inventory is true
            const { data: catItem } = await supabase.from("catalog_items").select("track_inventory").eq("id", item.catalog_item_id).single();
            if (catItem?.track_inventory) {
              // Decrement from origin_location_id
              const { data: level } = await supabase.from("inventory_levels")
                .select("id, quantity")
                .eq("catalog_item_id", item.catalog_item_id)
                .eq("location_id", current.origin_location_id)
                .single();
              
              if (level) {
                const newQty = Math.max(0, level.quantity - item.quantity);
                await supabase.from("inventory_levels").update({ quantity: newQty }).eq("id", level.id);
              } else {
                await supabase.from("inventory_levels").insert({
                  site_id: siteId,
                  location_id: current.origin_location_id,
                  catalog_item_id: item.catalog_item_id,
                  quantity: 0
                });
              }
            }
          }
        }
        updates.stock_decremented = true;
      }
    }

    // 4. Perform update
    const { data, error } = await supabase
      .from("shipments")
      .update(updates)
      .eq("id", shipmentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/shipments`);
    revalidatePath(`/shipments/${shipmentId}`);
    return { data: data as Shipment };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateShipmentTracking(siteId: string, shipmentId: string, updates: { carrier?: string; tracking_number?: string; estimated_delivery_at?: string }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shipments")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", shipmentId)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/shipments`);
    revalidatePath(`/shipments/${shipmentId}`);
    return { data: data as Shipment };
  } catch (error: any) {
    return { error: error.message };
  }
}
