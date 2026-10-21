"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Payment, Subscription } from "@/app/types";
import { getSubscriptionInvoiceDueDate, isDateOnly, normalizeDueDate } from "@/lib/finance/due-date";
import { requireAccountingAccess } from "@/app/accounting/access";
import { isOutstandingInvoice, type SubscriptionListItem } from "./invoice-summary";
import { getSubscriptionInvoicePeriod } from "./billing-period";

export interface SubscriptionInvoice {
  id: string;
  title: string;
  invoiceNumber: string | null;
  amount: number;
  amountDue: number;
  currency: string;
  status: "pending" | "completed" | "cancelled" | "refunded";
  saleDate: string;
  dueDate?: string | null;
  payments: Payment[];
}

export interface SubscriptionDetail extends Omit<Subscription, "lead" | "catalog_item"> {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string | null;
  };
  catalog_item: {
    id: string;
    name: string;
    description: string | null;
    kind: string | null;
    currency?: string | null;
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getSubscriptions(siteId: string) {
  try {
    const supabase = await requireAccountingAccess(siteId);
    const { data, error } = await supabase
      .from("subscriptions")
      .select(`
        *,
        catalog_item:catalog_items(id, name, description, kind, currency),
        lead:leads(id, name, email, phone),
        invoices:sales!sales_subscription_id_fkey(id, site_id, title, invoice_number, amount_due, currency, status)
      `)
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return { data: [], error: "Failed to load subscriptions" };
    }
    
    const subscriptions: SubscriptionListItem[] = (data || []).map((row: Subscription & {
      invoices?: { id: string; site_id: string; title: string; invoice_number: string | null;
        amount_due: number | string; currency: string | null; status: string }[];
    }) => {
      const { invoices, ...subscription } = row;
      return {
        ...subscription,
        pendingInvoices: (invoices || [])
          .filter((invoice) => invoice.site_id === siteId && isOutstandingInvoice({
            status: invoice.status, amountDue: Number(invoice.amount_due),
          }))
          .map((invoice) => ({
            id: invoice.id, title: invoice.title, invoiceNumber: invoice.invoice_number,
            amountDue: Number(invoice.amount_due), currency: invoice.currency || "USD",
          })),
      };
    });
    return { data: subscriptions };
  } catch {
    return { data: [], error: "Unable to access subscriptions" };
  }
}

export async function getSubscriptionDetail(siteId: string, subscriptionId: string) {
  if (!UUID_PATTERN.test(siteId) || !UUID_PATTERN.test(subscriptionId)) {
    return { subscription: null, invoices: [], error: "Invalid subscription request" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { subscription: null, invoices: [], error: "Not authenticated" };
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select(`
        *,
        catalog_item:catalog_items(id, name, description, kind, currency),
        lead:leads(id, name, email, phone, status)
      `)
      .eq("site_id", siteId)
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subscriptionError) {
      return { subscription: null, invoices: [], error: subscriptionError.message };
    }

    if (!subscription) {
      return { subscription: null, invoices: [], error: "Subscription not found" };
    }

    const { data: invoiceRows, error: invoicesError } = await supabase
      .from("sales")
      .select("id, title, invoice_number, amount, amount_due, currency, status, sale_date, due_date, payments")
      .eq("site_id", siteId)
      .eq("subscription_id", subscriptionId)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (invoicesError) {
      return { subscription: null, invoices: [], error: invoicesError.message };
    }

    const invoices: SubscriptionInvoice[] = (invoiceRows || []).map((invoice: {
      id: string; title: string; invoice_number: string | null; amount: number | string;
      amount_due: number | string; currency: string | null; status: SubscriptionInvoice["status"];
      sale_date: string; due_date?: string | null;
      payments?: { id: unknown; date: unknown; amount: unknown; method?: unknown; notes?: unknown }[] | null;
    }) => ({
      id: invoice.id,
      title: invoice.title,
      invoiceNumber: invoice.invoice_number || null,
      amount: Number(invoice.amount) || 0,
      amountDue: Number(invoice.amount_due) || 0,
      currency: invoice.currency || "USD",
      status: invoice.status,
      saleDate: invoice.sale_date,
      dueDate: invoice.due_date ?? null,
      payments: Array.isArray(invoice.payments)
        ? invoice.payments.map((payment) => ({
            id: String(payment.id),
            date: String(payment.date),
            amount: Number(payment.amount) || 0,
            method: String(payment.method || "unknown"),
            notes: payment.notes ? String(payment.notes) : undefined,
          }))
        : [],
    }));

    return {
      subscription: subscription as SubscriptionDetail,
      invoices,
    };
  } catch (error) {
    return {
      subscription: null,
      invoices: [],
      error: error instanceof Error ? error.message : "Failed to load subscription",
    };
  }
}

export async function createSubscriptionInvoice(input: {
  siteId: string;
  subscriptionId: string;
  amount: number;
  invoiceDate: string;
  billingDate?: string;
  dueDate?: string | null;
}) {
  if (!UUID_PATTERN.test(input.siteId) || !UUID_PATTERN.test(input.subscriptionId)) {
    return { error: "Invalid subscription request" };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 999999999999) {
    return { error: "Enter a valid invoice amount" };
  }

  if (!isDateOnly(input.invoiceDate)) {
    return { error: "Enter a valid invoice date" };
  }
  if (input.billingDate !== undefined && !isDateOnly(input.billingDate)) {
    return { error: "Enter a valid billing period (YYYY-MM-DD)" };
  }
  try { normalizeDueDate(input.dueDate); } catch { return { error: "Enter a valid due date (YYYY-MM-DD)" }; }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select(`
        *,
        catalog_item:catalog_items(name, kind)
      `)
      .eq("site_id", input.siteId)
      .eq("id", input.subscriptionId)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      return { error: subscriptionError?.message || "Subscription not found" };
    }

    const period = getSubscriptionInvoicePeriod(subscription.id, subscription.next_billing_date, input.billingDate);
    if (!period) return { error: "The subscription must have a valid next billing date" };

    const catalogItem = Array.isArray(subscription.catalog_item)
      ? subscription.catalog_item[0]
      : subscription.catalog_item;
    const planName = catalogItem?.name || "Subscription";

    const { data: invoice, error: insertError } = await supabase
      .from("sales")
      .insert({
        title: `${planName} invoice`,
        product_name: planName,
        product_type: catalogItem?.kind || "subscription",
        product_details: period,
        amount: input.amount,
        amount_due: input.amount,
        status: "pending",
        lead_id: subscription.lead_id,
        buyer_user_id: subscription.buyer_user_id || null,
        sale_date: input.invoiceDate,
        due_date: input.dueDate === undefined
          ? getSubscriptionInvoiceDueDate(subscription.due_date, subscription.next_billing_date, input.invoiceDate)
          : normalizeDueDate(input.dueDate),
        payment_method: null,
        source: "retail",
        channel: "manual",
        site_id: input.siteId,
        user_id: user.id,
        subscription_id: subscription.id,
        ...(subscription.location_id !== undefined ? { location_id: subscription.location_id } : {}),
      })
      .select("id")
      .single();

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    revalidatePath("/subscriptions");
    revalidatePath("/sales");

    return { data: { id: invoice.id } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create invoice",
    };
  }
}

export async function upsertSubscription(subscription: Partial<Subscription>) {
  try { normalizeDueDate(subscription.due_date); } catch { return { error: "Enter a valid due date (YYYY-MM-DD)" }; }
  try {
    const supabase = await createClient();

    let buyerUserId = subscription.buyer_user_id ?? null
    if (!buyerUserId && subscription.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("buyer_user_id")
        .eq("id", subscription.lead_id)
        .maybeSingle()
      buyerUserId = lead?.buyer_user_id || null
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .upsert({
        ...subscription,
        ...(subscription.due_date !== undefined ? { due_date: normalizeDueDate(subscription.due_date) } : {}),
        buyer_user_id: buyerUserId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // Sync or revoke entitlements based on the final status
    const finalStatus = data.status;
    if (finalStatus === 'active') {
      const { syncSubscriptionEntitlements } = await import('@/app/commerce/entitlements');
      await syncSubscriptionEntitlements(data.id, true);
    } else if (['cancelled', 'expired', 'paused'].includes(finalStatus)) {
      const { revokeForSubscription } = await import('@/app/commerce/entitlements');
      await revokeForSubscription(data.id, true);
    }
    
    revalidatePath("/subscriptions");
    return { data: data as Subscription };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create subscription" };
  }
}

export async function updateSubscriptionStatus(siteId: string, subscriptionId: string, status: Subscription['status']) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) return { error: error.message };
    
    // Revoke entitlements if subscription is cancelled, expired, or paused
    if (['cancelled', 'expired', 'paused'].includes(status)) {
      const { revokeForSubscription } = await import('@/app/commerce/entitlements');
      await revokeForSubscription(subscriptionId, true);
    } else if (status === 'active') {
      const { syncSubscriptionEntitlements } = await import('@/app/commerce/entitlements');
      await syncSubscriptionEntitlements(subscriptionId, true);
    }
    
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${subscriptionId}`);
    return { data: data as Subscription };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update subscription" };
  }
}

export async function updateSubscriptionDueDate(siteId: string, subscriptionId: string, value: string | null) {
  return saveSubscriptionDate(siteId, subscriptionId, "due_date", value);
}

export async function updateSubscriptionNextBillingDate(siteId: string, subscriptionId: string, value: string) {
  return saveSubscriptionDate(siteId, subscriptionId, "next_billing_date", value);
}

async function saveSubscriptionDate(
  siteId: string,
  subscriptionId: string,
  field: "due_date" | "next_billing_date",
  value: string | null,
) {
  if (!UUID_PATTERN.test(siteId) || !UUID_PATTERN.test(subscriptionId)) return { error: "Invalid subscription request" };
  if (field === "next_billing_date" && !isDateOnly(value)) return { error: "Enter a valid next billing date (YYYY-MM-DD)" };
  try {
    const date = normalizeDueDate(value);
    const supabase = await requireAccountingAccess(siteId, "update");
    const { data: current, error: readError } = await supabase.from("subscriptions")
      .select("next_billing_date, due_date, updated_at").eq("site_id", siteId).eq("id", subscriptionId).maybeSingle();
    if (readError || !current) return { error: "Subscription not found" };
    if (field === "due_date" && date && !current.next_billing_date) return { error: "A next billing date is required to configure a due date" };
    const update = field === "next_billing_date"
      ? {
          next_billing_date: `${date}T00:00:00.000Z`,
          due_date: getSubscriptionInvoiceDueDate(current.due_date, current.next_billing_date, date!),
        }
      : { due_date: date };
    const { data, error } = await supabase.from("subscriptions")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("site_id", siteId).eq("id", subscriptionId).eq("updated_at", current.updated_at)
      .select("next_billing_date, due_date, updated_at").maybeSingle();
    if (error) return { error: "Unable to save subscription date" };
    if (!data) return { error: "Subscription changed while editing. Reload and retry." };
    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${subscriptionId}`);
    return { success: true, data: data as Pick<Subscription, "next_billing_date" | "due_date" | "updated_at"> };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save subscription date" };
  }
}
