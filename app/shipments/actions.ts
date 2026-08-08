"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ShipmentParams, ShipmentWithRelations } from "./types";
import { Shipment } from "@/app/types";
import {
  buildTrackingNumber,
  canRecordShipmentLocation,
  VALID_STATUS_TRANSITIONS,
} from "./tracking";

async function attachAssigneeProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: any[]
): Promise<ShipmentWithRelations[]> {
  const ids = Array.from(
    new Set(rows.map((r) => r.assigned_to).filter(Boolean))
  ) as string[];

  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, assignee_profile: null }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", ids);

  const byId = new Map((profiles || []).map((p) => [p.id, { name: p.name || "Unknown" }]));

  return rows.map((r) => ({
    ...r,
    assignee_profile: r.assigned_to ? byId.get(r.assigned_to) || null : null,
  }));
}

export async function listShipments({ siteId, status, leadId, q, locationId, page = 1, pageSize = 50 }: ShipmentParams) {
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

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (locationId && locationId !== "all") {
      query = query.eq("origin_location_id", locationId);
    }
    if (leadId) {
      query = query.eq("lead_id", leadId);
    }
    if (q) {
      query = query.or(`tracking_number.ilike.%${q}%,leads.name.ilike.%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const withAssignees = await attachAssigneeProfiles(supabase, data || []);
    return { data: withAssignees, count: count || 0 };
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
      sale_orders (
        order_number,
        total,
        status,
        sale_order_items (id, catalog_item_id, name, quantity, status, shipment_id)
      ),
      locations!origin_location_id (name)
    `)
    .eq("id", id)
    .single();

  if (error) return { error: error.message };

  const [withAssignee] = await attachAssigneeProfiles(supabase, [data]);
  return { data: withAssignee };
}

export async function setShipmentLineItems(siteId: string, shipmentId: string, itemIds: string[]) {
  try {
    const supabase = await createClient();

    let clearQuery = supabase
      .from("sale_order_items")
      .update({ shipment_id: null })
      .eq("site_id", siteId)
      .eq("shipment_id", shipmentId);

    if (itemIds.length > 0) {
      clearQuery = clearQuery.not("id", "in", `(${itemIds.join(",")})`);
    }
    await clearQuery;

    if (itemIds.length > 0) {
      await supabase
        .from("sale_order_items")
        .update({ shipment_id: shipmentId })
        .eq("site_id", siteId)
        .in("id", itemIds);
    }

    revalidatePath(`/shipments/${shipmentId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in setShipmentLineItems:", error);
    return { error: error.message };
  }
}

export async function createShipment(params: {
  siteId: string;
  saleOrderId: string;
  saleId?: string;
  leadId?: string;
  originLocationId: string;
  shippingAddress?: any;
  carrier?: string;
  trackingNumber?: string;
  assignedTo?: string;
  itemIds?: string[];
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
        lead_id: params.leadId || null,
        origin_location_id: params.originLocationId,
        shipping_address: params.shippingAddress,
        carrier: params.carrier,
        tracking_number: params.trackingNumber,
        assigned_to: params.assignedTo || null,
        user_id: params.userId,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (params.itemIds && params.itemIds.length > 0) {
      await supabase
        .from("sale_order_items")
        .update({ shipment_id: data.id })
        .eq("site_id", params.siteId)
        .in("id", params.itemIds);
    }

    revalidatePath(`/shipments`);
    if (params.saleId) revalidatePath(`/sales/${params.saleId}`);
    return { data: data as Shipment };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateShipmentStatus(siteId: string, shipmentId: string, newStatus: string) {
  try {
    const supabase = await createClient();

    const { data: current } = await supabase
      .from("shipments")
      .select("status, stock_decremented, sale_order_id, origin_location_id")
      .eq("id", shipmentId)
      .single();
    if (!current) throw new Error("Shipment not found");

    if (
      !VALID_STATUS_TRANSITIONS[current.status]?.includes(newStatus) &&
      current.status !== newStatus
    ) {
      throw new Error(`Invalid transition from ${current.status} to ${newStatus}`);
    }

    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "shipped") updates.shipped_at = new Date().toISOString();
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();

    if ((newStatus === "shipped" || newStatus === "delivered") && !current.stock_decremented) {
      const { data: settings } = await supabase
        .from("settings")
        .select("commerce")
        .eq("site_id", siteId)
        .single();
      const policy = settings?.commerce?.decrement_stock_on || "ship";

      if (
        (policy === "ship" && (newStatus === "shipped" || newStatus === "delivered")) ||
        (policy === "order_complete" && newStatus === "delivered")
      ) {
        const { data: orderItems } = await supabase
          .from("sale_order_items")
          .select("catalog_item_id, quantity")
          .eq("sale_order_id", current.sale_order_id)
          .eq("shipment_id", shipmentId)
          .not("catalog_item_id", "is", null);

        if (orderItems && orderItems.length > 0) {
          for (const item of orderItems) {
            const { data: catItem } = await supabase
              .from("catalog_items")
              .select("track_inventory")
              .eq("id", item.catalog_item_id)
              .single();
            if (catItem?.track_inventory) {
              const { data: level } = await supabase
                .from("inventory_levels")
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
                  quantity: 0,
                });
              }
            }
          }
        }
        updates.stock_decremented = true;
      }
    }

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

export async function updateShipmentTracking(
  siteId: string,
  shipmentId: string,
  updates: { carrier?: string; tracking_number?: string; estimated_delivery_at?: string }
) {
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

export async function generateTrackingNumber(siteId: string) {
  return buildTrackingNumber(siteId);
}

export async function assignShipmentCourier(
  siteId: string,
  shipmentId: string,
  assignedTo: string | null
) {
  try {
    const supabase = await createClient();

    if (assignedTo) {
      const { data: member } = await supabase
        .from("site_members")
        .select("id")
        .eq("site_id", siteId)
        .eq("user_id", assignedTo)
        .eq("status", "active")
        .maybeSingle();
      const { data: site } = await supabase.from("sites").select("user_id").eq("id", siteId).single();
      if (!member && site?.user_id !== assignedTo) {
        throw new Error("Assignee must be an active site member");
      }
    }

    const { data, error } = await supabase
      .from("shipments")
      .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
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

export async function recordShipmentLocation(
  siteId: string,
  shipmentId: string,
  location: { lat: number; lng: number; accuracy?: number }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: shipment, error: getError } = await supabase
      .from("shipments")
      .select("status, assigned_to")
      .eq("id", shipmentId)
      .eq("site_id", siteId)
      .single();

    if (getError || !shipment) throw new Error("Shipment not found");

    const guard = canRecordShipmentLocation({
      assignedTo: shipment.assigned_to,
      status: shipment.status,
      userId: user.id,
    });
    if (!guard.ok) throw new Error(guard.error);

    const { error: insertError } = await supabase.from("shipment_location_pings").insert({
      site_id: siteId,
      shipment_id: shipmentId,
      user_id: user.id,
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy ?? null,
    });

    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase
      .from("shipments")
      .update({
        last_lat: location.lat,
        last_lng: location.lng,
        last_located_at: new Date().toISOString(),
      })
      .eq("id", shipmentId);

    if (updateError) throw new Error(updateError.message);

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function listShipmentLocationPings(siteId: string, shipmentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shipment_location_pings")
      .select("*")
      .eq("shipment_id", shipmentId)
      .eq("site_id", siteId)
      .order("recorded_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}
