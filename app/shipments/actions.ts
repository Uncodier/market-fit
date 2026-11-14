"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAuthorizedShipment, type CreateShipmentInput } from './create-shipment';
import { userCanOnSite } from '@/lib/permissions/site-access';
import { ShipmentParams, ShipmentWithRelations } from "./types";
import { Shipment } from "@/app/types";
import { applyLocationInventoryDelta } from "@/app/commerce/inventory-delta";
import { reconcileOrderLineInventory } from "@/app/commerce/order-line-inventory";
import { usesOrderLineInventoryReceipts } from "@/app/commerce/order-inventory-scope";
import { isUnassignedShipmentLine } from './shipment-line-selection';
import { assertInternalShipment } from "@/lib/marketplace/mutation-guards";
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

  const byId = new Map(
    (profiles || []).map((profile: { id: string; name: string | null }) => [
      profile.id,
      { name: profile.name || "Unknown" },
    ]),
  );

  return rows.map((r) => ({
    ...r,
    assignee_profile: r.assigned_to ? byId.get(r.assigned_to) || null : null,
  }));
}

export async function listShipments({ siteId, status, leadId, q, locationId, page = 1, pageSize = 50, sort }: ShipmentParams) {
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
      .eq("site_id", siteId);
      
    if (sort === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else if (sort === "updated_at") {
      query = query.order("updated_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

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
    await assertInternalShipment(supabase, siteId, shipmentId);
    const { data: shipment, error: shipmentError } = await supabase.from('shipments')
      .select('sale_order_id, status').eq('site_id', siteId).eq('id', shipmentId).single();
    if (shipmentError || !shipment) throw new Error('Shipment not found');
    if (!['pending', 'preparing'].includes(shipment.status)) throw new Error('Dispatched shipment lines cannot be changed');
    if (itemIds.length) {
      const { data: lines, error } = await supabase.from('sale_order_items')
        .select('id, shipment_id, status, metadata').eq('site_id', siteId)
        .eq('sale_order_id', shipment.sale_order_id).in('id', itemIds);
      if (error || lines?.length !== new Set(itemIds).size || lines.some((line: any) =>
        !isUnassignedShipmentLine({ ...line, shipment_id: line.shipment_id === shipmentId ? null : line.shipment_id }))) {
        throw new Error('Shipment lines are unavailable or already assigned');
      }
    }

    let clearQuery = supabase
      .from("sale_order_items")
      .update({ shipment_id: null })
      .eq("site_id", siteId)
      .eq('sale_order_id', shipment.sale_order_id)
      .eq("shipment_id", shipmentId);

    if (itemIds.length > 0) {
      clearQuery = clearQuery.not("id", "in", `(${itemIds.join(",")})`);
    }
    const { error: clearError } = await clearQuery;
    if (clearError) throw new Error('Shipment line removal could not be confirmed');

    if (itemIds.length > 0) {
      const { data: attached, error } = await supabase
        .from("sale_order_items")
        .update({ shipment_id: shipmentId })
        .eq("site_id", siteId)
        .eq('sale_order_id', shipment.sale_order_id)
        .or(`shipment_id.is.null,shipment_id.eq.${shipmentId}`)
        .in("id", itemIds).select('id');
      if (error || attached?.length !== new Set(itemIds).size) throw new Error('Shipment line assignment could not be confirmed');
    }

    revalidatePath(`/shipments/${shipmentId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in setShipmentLineItems:", error);
    return { error: error.message };
  }
}

export async function createShipment(params: CreateShipmentInput) {
  try {
    const supabase = await createClient(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !await userCanOnSite(supabase, params.siteId, 'insert')) {
      return { error: 'Shipment creation is not authorized' };
    }
    const { data: order, error } = await supabase.from('sale_orders').select('id, sale_id')
      .eq('id', params.saleOrderId).eq('site_id', params.siteId).single();
    if (error || !order || (params.saleId && params.saleId !== order.sale_id)) return { error: 'Order not available' };
    return createAuthorizedShipment(supabase, { ...params, saleId: order.sale_id || undefined, userId: user.id });
  } catch {
    return { error: 'Shipment creation could not be confirmed' };
  }
}

export async function updateShipmentStatus(siteId: string, shipmentId: string, newStatus: string) {
  try {
    const supabase = await createClient(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !await userCanOnSite(supabase, siteId, 'update')) {
      return { error: 'Shipment update is not authorized' };
    }

    const { data: current } = await supabase
      .from("shipments")
      .select("status, stock_decremented, sale_order_id, origin_location_id, metadata")
      .eq("id", shipmentId)
      .eq("site_id", siteId)
      .single();
    if (!current) throw new Error("Shipment not found");
    if (current.metadata?.marketplace) {
      return { error: "This shipment is managed by the marketplace provider" };
    }

    if (
      !VALID_STATUS_TRANSITIONS[current.status]?.includes(newStatus) &&
      current.status !== newStatus
    ) {
      throw new Error(`Invalid transition from ${current.status} to ${newStatus}`);
    }

    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "shipped") updates.shipped_at = new Date().toISOString();
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();

    if (newStatus === "shipped" || newStatus === "delivered") {
      const receiptOwned = await usesOrderLineInventoryReceipts(supabase, siteId, current.sale_order_id);
      const { data: settings, error: settingsError } = await supabase
        .from("settings")
        .select("commerce")
        .eq("site_id", siteId)
        .single();
      if (settingsError) throw new Error('Shipment inventory policy could not be read');
      const policy = settings?.commerce?.decrement_stock_on || "ship";

      if ((receiptOwned || !current.stock_decremented) && (
        (policy === "ship" && (newStatus === "shipped" || newStatus === "delivered")) ||
        (policy === "order_complete" && newStatus === "delivered")
      )) {
        const { data: orderItems, error: itemsError } = await supabase
          .from("sale_order_items")
          .select("id, catalog_item_id, quantity, metadata")
          .eq("site_id", siteId)
          .eq("sale_order_id", current.sale_order_id)
          .eq("shipment_id", shipmentId)
          .not("catalog_item_id", "is", null);
        if (itemsError) throw new Error('Shipment inventory lines could not be read');

        if (orderItems && orderItems.length > 0) {
          for (const item of orderItems) {
            if (receiptOwned) {
              const receipt = await reconcileOrderLineInventory(supabase, {
                siteId, orderId: current.sale_order_id, lineId: item.id,
                locationId: current.origin_location_id, targetQuantity: Number(item.quantity),
              });
              if (receipt.reviewRequired) throw new Error('Inventory review required before shipping this order');
              continue;
            }
            if (item.metadata?.completed_without_stock === true) continue;
            const { data: catItem } = await supabase
              .from("catalog_items")
              .select("track_inventory")
              .eq("id", item.catalog_item_id)
              .eq("site_id", siteId)
              .single();
            if (catItem?.track_inventory) {
              await applyLocationInventoryDelta(supabase, {
                siteId,
                catalogItemId: item.catalog_item_id,
                locationId: current.origin_location_id,
                delta: -item.quantity,
                floorZero: true,
              });
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

export async function updateShipmentTracking(
  siteId: string,
  shipmentId: string,
  updates: { carrier?: string; tracking_number?: string; estimated_delivery_at?: string }
) {
  try {
    const supabase = await createClient();
    await assertInternalShipment(supabase, siteId, shipmentId);
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
    await assertInternalShipment(supabase, siteId, shipmentId);

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
      .select("status, assigned_to, metadata")
      .eq("id", shipmentId)
      .eq("site_id", siteId)
      .single();

    if (getError || !shipment) throw new Error("Shipment not found");
    if (shipment.metadata?.marketplace) {
      throw new Error("Location updates are managed by the marketplace provider");
    }

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
