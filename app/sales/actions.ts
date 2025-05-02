"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Sale, SaleData } from "@/app/types";

/**
 * Get all sales for a site
 */
export async function getSales(siteId: string) {
  try {
    const supabase = await createClient();

    // Fetch sales from the database
    const { data: salesData, error } = await supabase
      .from("sales")
      .select("*, leads(name)")
      .eq("site_id", siteId)
      .order("sale_date", { ascending: false });

    if (error) {
      console.error("Error fetching sales:", error);
      return { error: error.message };
    }

    // Transform the data to match the Sale interface
    const sales: Sale[] = salesData.map((sale: any) => ({
      id: sale.id,
      title: sale.title,
      description: sale.description || undefined,
      productName: sale.product_name || "",
      productType: sale.product_type || undefined,
      productDetails: sale.product_details || undefined,
      amount: sale.amount,
      amount_due: sale.amount_due || 0,
      currency: sale.currency || undefined,
      status: sale.status,
      leadId: sale.lead_id,
      leadName: sale.leads?.name || "Anonymous Customer",
      campaignId: sale.campaign_id,
      segmentId: sale.segment_id,
      saleDate: sale.sale_date,
      paymentMethod: sale.payment_method || "Unknown",
      paymentDetails: sale.payment_details || undefined,
      payments: sale.payments || [],
      invoiceNumber: sale.invoice_number || undefined,
      referenceCode: sale.reference_code || undefined,
      externalId: sale.external_id || undefined,
      source: sale.source,
      channel: sale.channel || undefined,
      notes: sale.notes || undefined,
      tags: sale.tags || undefined,
      siteId: sale.site_id,
      userId: sale.user_id,
      createdAt: sale.created_at,
      updatedAt: sale.updated_at,
      commandId: sale.command_id || undefined
    }));

    return { sales };
  } catch (error) {
    console.error("Error in getSales:", error);
    return { error: "Failed to fetch sales data" };
  }
}

/**
 * Create a new sale
 */
export async function createSale(data: {
  title: string;
  productName?: string;
  productType?: string;
  amount: number;
  amount_due?: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  leadId?: string;
  campaignId: string;
  segmentId?: string;
  saleDate: string;
  paymentMethod?: string;
  source: 'retail' | 'online';
  notes?: string;
  siteId: string;
}) {
  try {
    const supabase = await createClient();
    
    const saleData: Partial<SaleData> = {
      title: data.title,
      product_name: data.productName || null,
      product_type: data.productType || null,
      amount: data.amount,
      amount_due: data.amount_due !== undefined ? data.amount_due : data.amount,
      status: data.status,
      lead_id: data.leadId || null,
      campaign_id: data.campaignId,
      segment_id: data.segmentId || null,
      sale_date: data.saleDate,
      payment_method: data.paymentMethod || null,
      source: data.source,
      notes: data.notes || null,
      site_id: data.siteId,
    };

    const { data: sale, error } = await supabase
      .from("sales")
      .insert([saleData])
      .select()
      .single();

    if (error) {
      console.error("Error creating sale:", error);
      return { error: error.message };
    }

    // Revalidate the sales page
    revalidatePath("/sales");
    
    return { sale };
  } catch (error) {
    console.error("Error in createSale:", error);
    return { error: "Failed to create sale" };
  }
}

/**
 * Update an existing sale
 */
export async function updateSale(siteId: string, updatedSale: Sale) {
  try {
    const supabase = await createClient();
    
    const updateData: Partial<SaleData> = {
      title: updatedSale.title,
      product_name: updatedSale.productName,
      product_type: updatedSale.productType || null,
      amount: updatedSale.amount,
      amount_due: updatedSale.amount_due,
      status: updatedSale.status,
      lead_id: updatedSale.leadId,
      segment_id: updatedSale.segmentId,
      source: updatedSale.source,
      payments: updatedSale.payments,
    };

    const { data: sale, error } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", updatedSale.id)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) {
      console.error("Error updating sale:", error);
      return { error: error.message };
    }

    // Revalidate the sales page
    revalidatePath("/sales");
    
    return { sale };
  } catch (error) {
    console.error("Error in updateSale:", error);
    return { error: "Failed to update sale" };
  }
}

/**
 * Delete a sale
 */
export async function deleteSale(siteId: string, id: string) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from("sales")
      .delete()
      .eq("id", id)
      .eq("site_id", siteId);

    if (error) {
      console.error("Error deleting sale:", error);
      return { error: error.message };
    }

    // Revalidate the sales page
    revalidatePath("/sales");
    
    return { success: true };
  } catch (error) {
    console.error("Error in deleteSale:", error);
    return { error: "Failed to delete sale" };
  }
}

/**
 * Get sales by ID
 */
export async function getSaleById(siteId: string, saleId: string) {
  try {
    const supabase = await createClient();

    // Fetch the sale from the database
    const { data: saleData, error } = await supabase
      .from("sales")
      .select("*, leads(name)")
      .eq("site_id", siteId)
      .eq("id", saleId)
      .single();

    if (error) {
      console.error("Error fetching sale:", error);
      return { error: error.message };
    }

    // Transform the data to match the Sale interface
    const sale: Sale = {
      id: saleData.id,
      title: saleData.title,
      description: saleData.description || undefined,
      productName: saleData.product_name || "",
      productType: saleData.product_type || undefined,
      productDetails: saleData.product_details || undefined,
      amount: saleData.amount,
      amount_due: saleData.amount_due || 0,
      currency: saleData.currency || undefined,
      status: saleData.status,
      leadId: saleData.lead_id,
      leadName: saleData.leads?.name || "Anonymous Customer",
      campaignId: saleData.campaign_id,
      segmentId: saleData.segment_id,
      saleDate: saleData.sale_date,
      paymentMethod: saleData.payment_method || "Unknown",
      paymentDetails: saleData.payment_details || undefined,
      payments: saleData.payments || [],
      invoiceNumber: saleData.invoice_number || undefined,
      referenceCode: saleData.reference_code || undefined,
      externalId: saleData.external_id || undefined,
      source: saleData.source,
      channel: saleData.channel || undefined,
      notes: saleData.notes || undefined,
      tags: saleData.tags || undefined,
      siteId: saleData.site_id,
      userId: saleData.user_id,
      createdAt: saleData.created_at,
      updatedAt: saleData.updated_at,
      commandId: saleData.command_id || undefined
    };

    return { sale };
  } catch (error) {
    console.error("Error in getSaleById:", error);
    return { error: "Failed to fetch sale data" };
  }
}

/**
 * Get sale order by sale ID
 */
export async function getSaleOrderBySaleId(siteId: string, saleId: string) {
  try {
    const supabase = await createClient();

    // Fetch the sale order from the database
    const { data: saleOrderData, error } = await supabase
      .from("sale_orders")
      .select("*")
      .eq("sale_id", saleId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching sale order:", error);
      return { error: error.message };
    }

    // If no sale order found, return empty data
    if (!saleOrderData) {
      return { saleOrder: null };
    }

    // Transform the data to match the SaleOrder interface
    const saleOrder = {
      id: saleOrderData.id,
      saleId: saleOrderData.sale_id,
      orderNumber: saleOrderData.order_number,
      items: saleOrderData.items || [],
      subtotal: saleOrderData.subtotal,
      taxTotal: saleOrderData.tax_total,
      discountTotal: saleOrderData.discount_total,
      total: saleOrderData.total,
      notes: saleOrderData.notes,
      createdAt: saleOrderData.created_at,
      updatedAt: saleOrderData.updated_at
    };

    return { saleOrder };
  } catch (error) {
    console.error("Error in getSaleOrderBySaleId:", error);
    return { error: "Failed to fetch sale order data" };
  }
}

/**
 * Create a new sale order
 */
export async function createSaleOrder(data: {
  saleId: string;
  orderNumber: string;
  items: Array<{
    id?: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  notes?: string;
  siteId: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return { error: "Unauthorized" };
    }
    
    const saleOrderData = {
      sale_id: data.saleId,
      order_number: data.orderNumber,
      items: data.items,
      subtotal: data.subtotal,
      tax_total: data.taxTotal,
      discount_total: data.discountTotal,
      total: data.total,
      notes: data.notes || null,
      site_id: data.siteId,
      user_id: session.user.id,
    };

    const { data: saleOrder, error } = await supabase
      .from("sale_orders")
      .insert([saleOrderData])
      .select()
      .single();

    if (error) {
      console.error("Error creating sale order:", error);
      return { error: error.message };
    }

    // Revalidate the sales page
    revalidatePath(`/sales/${data.saleId}`);
    
    return { 
      saleOrder: {
        id: saleOrder.id,
        saleId: saleOrder.sale_id,
        orderNumber: saleOrder.order_number,
        items: saleOrder.items || [],
        subtotal: saleOrder.subtotal,
        taxTotal: saleOrder.tax_total,
        discountTotal: saleOrder.discount_total,
        total: saleOrder.total,
        notes: saleOrder.notes,
        createdAt: saleOrder.created_at,
        updatedAt: saleOrder.updated_at
      }
    };
  } catch (error) {
    console.error("Error in createSaleOrder:", error);
    return { error: "Failed to create sale order" };
  }
} 