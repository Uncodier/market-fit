"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  buildPublicDocUrl,
  isPublicAccessTokenActive,
  isValidPublicAccessToken,
} from "@/app/documents/public-token"
import {
  ensurePublicAccessTokenForRecord,
  revokePublicAccessTokenForRecord,
} from "@/app/documents/public-token-store"
import {
  buildDocumentEmailSubject,
  getSendGridConfig,
  sendDocumentEmailViaSendGrid,
} from "@/app/documents/send-document-email"
import { buildDocumentPdf, uint8ToBase64 } from "@/app/documents/document-pdf"
import { resolveSalePaymentMethod } from "@/app/documents/document-meta"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { documentT, formatDocumentMoney } from "@/app/lib/i18n/document-t"
import { loadSiteBranding, publicTokenSchemaError } from "@/app/documents/site-branding"

const PUBLIC_ORDER_SELECT = `
  id,
  site_id,
  owner_site_id,
  sale_id,
  order_number,
  status,
  currency,
  created_at,
  subtotal,
  tax_total,
  discount_total,
  total,
  fulfillment_method,
  shipping_address,
  items,
  public_access_token_expires_at,
  public_access_token_revoked_at,
  sale_order_items(name, quantity, unit_price, subtotal, status),
  site:sites!site_id(id, name, logo_url, url),
  sales:sale_id(status, amount_due, payment_method, leads(name, email))
`

const PUBLIC_ORDER_SALE_SELECT =
  "status, amount_due, payment_method, leads(name, email)"

export async function ensureOrderPublicAccessToken(orderId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "sale_orders",
    orderId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) ||
        result.error ||
        "Order not found",
    }
  }
  return result
}

export async function rotateOrderPublicAccessToken(orderId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "sale_orders",
    orderId,
    { rotate: true }
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) || result.error,
    }
  }
  return result
}

export async function revokeOrderPublicAccessToken(orderId: string) {
  const supabase = await createClient()
  const result = await revokePublicAccessTokenForRecord(
    supabase,
    "sale_orders",
    orderId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) || result.error,
    }
  }
  return result
}

export async function getOrderByPublicToken(token: string) {
  if (!isValidPublicAccessToken(token)) return { error: "Invalid order link" }

  // Disambiguate site_id vs owner_site_id FKs to sites.
  const supabase = await createServiceClient(true)
  const { data: order, error } = await supabase
    .from("sale_orders")
    .select(PUBLIC_ORDER_SELECT)
    .eq("public_access_token", token)
    .single()

  if (error || !order) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Order not found",
    }
  }

  if (order.status === "cancelled") {
    return { error: "This order is no longer available" }
  }
  if (!isPublicAccessTokenActive(order)) {
    return { error: "This order link is no longer available" }
  }

  let sale: any = Array.isArray(order.sales) ? order.sales[0] : order.sales
  let lead: any = sale?.leads
    ? Array.isArray(sale.leads)
      ? sale.leads[0]
      : sale.leads
    : null

  // Fallback fetch if the FK embed did not resolve.
  if (!sale && order.sale_id) {
    const { data: saleData } = await supabase
      .from("sales")
      .select(PUBLIC_ORDER_SALE_SELECT)
      .eq("id", order.sale_id)
      .single()
    sale = saleData || null
    const nestedLead = saleData?.leads
    lead = nestedLead
      ? Array.isArray(nestedLead)
        ? nestedLead[0]
        : nestedLead
      : null
  }

  const branding = await loadSiteBranding(supabase, order.site_id || order.owner_site_id)
  const lineItems = mapDocumentLineItems(
    order.sale_order_items?.length > 0
      ? order.sale_order_items
      : order.items || []
  )
  const site = Array.isArray(order.site) ? order.site[0] : order.site
  const location =
    branding.location &&
    typeof branding.location === "object" &&
    !Array.isArray(branding.location)
      ? {
          name: branding.location.name ?? null,
          address: branding.location.address ?? null,
          city: branding.location.city ?? null,
          state: branding.location.state ?? null,
          zip: branding.location.zip ?? null,
          country: branding.location.country ?? null,
        }
      : null

  return {
    data: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      currency: order.currency,
      created_at: order.created_at,
      subtotal: order.subtotal,
      tax_total: order.tax_total,
      discount_total: order.discount_total,
      total: order.total,
      fulfillment_method: order.fulfillment_method,
      shipping_address:
        order.shipping_address &&
        typeof order.shipping_address === "object" &&
        !Array.isArray(order.shipping_address)
          ? {
              line1: order.shipping_address.line1 ?? null,
              line2: order.shipping_address.line2 ?? null,
              city: order.shipping_address.city ?? null,
              state: order.shipping_address.state ?? null,
              zip: order.shipping_address.zip ?? null,
              country: order.shipping_address.country ?? null,
            }
          : null,
      items: lineItems,
      leads: lead ? { name: lead.name ?? null, email: lead.email ?? null } : null,
      sales: sale
        ? {
            status: sale.status,
            amount_due: sale.amount_due,
            payment_method: sale.payment_method ?? null,
          }
        : null,
      site: site
        ? {
            id: site.id,
            name: site.name ?? null,
            logo_url: site.logo_url ?? null,
            url: site.url ?? null,
          }
        : null,
    },
    branding: {
      site: {
        id: branding.site.id,
        name: branding.site.name,
        logo_url: branding.site.logo_url,
        url: branding.site.url,
      },
      locale: branding.locale,
      location,
    },
  }
}


export async function sendSaleOrder(id: string) {
  const supabase = await createClient()
  // Disambiguate site_id vs owner_site_id FKs to sites.
  const { data: order, error } = await supabase
    .from("sale_orders")
    .select("*, sale_order_items(*), site:sites!site_id(id, name, logo_url, url)")
    .eq("id", id)
    .single()

  if (error || !order) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Order not found",
    }
  }
  if (order.status === "cancelled") return { error: "Cancelled orders cannot be emailed" }

  let lead: any = null
  let sale: any = null
  if (order.sale_id) {
    const { data: saleData } = await supabase
      .from("sales")
      .select("id, status, amount_due, payment_method, payment_details, payments, stripe_checkout_session_id, stripe_payment_intent_id, leads(id, name, email)")
      .eq("id", order.sale_id)
      .single()
    sale = saleData || null
    lead = saleData?.leads || null
  }

  const toEmail = lead?.email?.trim()
  if (!toEmail) return { error: "Client email is required to send this order" }

  const mailConfig = getSendGridConfig()
  if (!mailConfig) {
    return { error: "Email is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL)" }
  }

  const siteId = order.site_id || order.owner_site_id
  const branding = await loadSiteBranding(supabase, siteId)
  const joinedSite = Array.isArray(order.site) ? order.site[0] : order.site
  const site = joinedSite || branding.site
  const locale = branding.locale

  const tokenRes = await ensureOrderPublicAccessToken(id)
  if (tokenRes.error || !tokenRes.token) {
    return { error: tokenRes.error || "Failed to create public order link" }
  }

  const viewLink = buildPublicDocUrl("so", tokenRes.token)
  const checkoutLink =
    sale?.status === "pending" && Number(sale.amount_due) > 0
      ? viewLink
      : null

  const docRef = String(order.order_number || order.id).substring(0, 12)
  const currency = order.currency || "USD"
  const totalLabel = formatDocumentMoney(Number(order.total) || 0, currency, locale)
  const siteName = site?.name || "Order"
  const items = mapDocumentLineItems(order.sale_order_items)

  const pdfBytes = await buildDocumentPdf({
    docKindLabel: documentT(locale, "orders.detail.breadcrumbOrder") || "Order",
    docRef,
    status: order.status,
    currency,
    created_at: order.created_at,
    subtotal: order.subtotal,
    tax_total: order.tax_total,
    discount_total: order.discount_total,
    total: order.total,
    items,
    party: { name: lead?.name, email: lead?.email },
    site,
    location: branding.location,
    locale,
    viewLink,
    reviewLabelKey: "documents.reviewOnline",
    statusKind: "orders",
    fulfillmentMethod: order.fulfillment_method,
    paymentMethod: resolveSalePaymentMethod(sale),
    shippingAddress: order.shipping_address,
  })

  const emailResult = await sendDocumentEmailViaSendGrid({
    toEmail,
    toName: lead?.name,
    fromEmail: mailConfig.fromEmail,
    fromName: mailConfig.fromName || siteName,
    subject: buildDocumentEmailSubject({
      siteName,
      docRef,
      locale,
      i18nPrefix: "orders",
    }),
    siteName,
    docRef,
    totalLabel,
    viewLink,
    checkoutLink,
    pdfBase64: uint8ToBase64(pdfBytes),
    pdfFilename: `order-${docRef}.pdf`,
    apiKey: mailConfig.apiKey,
    locale,
    i18nPrefix: "orders",
  })

  if ("error" in emailResult) return { error: emailResult.error }

  const now = new Date().toISOString()
  const { data: updated, error: stampError } = await supabase
    .from("sale_orders")
    .update({ last_emailed_at: now })
    .eq("id", id)
    .select("*")
    .single()

  if (stampError) {
    console.error("Order email delivered but audit timestamp failed:", stampError)
    return {
      success: true,
      data: { ...order, leads: lead },
      emailed: true,
      auditRecorded: false,
      warning: "Email was delivered, but the delivery timestamp could not be saved.",
    }
  }

  return {
    success: true,
    data: { ...updated, leads: lead },
    emailed: true,
    auditRecorded: true,
  }
}

