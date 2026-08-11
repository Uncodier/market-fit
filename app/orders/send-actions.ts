"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  buildPublicDocUrl,
  generatePublicAccessToken,
  isValidPublicAccessToken,
} from "@/app/documents/public-token"
import {
  buildDocumentEmailSubject,
  getSendGridConfig,
  sendDocumentEmailViaSendGrid,
} from "@/app/documents/send-document-email"
import { buildDocumentPdf, uint8ToBase64 } from "@/app/documents/document-pdf"
import { documentT, formatDocumentMoney } from "@/app/lib/i18n/document-t"
import { loadSiteBranding, publicTokenSchemaError } from "@/app/documents/site-branding"

export async function ensureOrderPublicAccessToken(orderId: string) {
  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from("sale_orders")
    .select("id, public_access_token")
    .eq("id", orderId)
    .single()

  if (error || !order) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Order not found",
    }
  }

  if (order.public_access_token && isValidPublicAccessToken(order.public_access_token)) {
    return { token: order.public_access_token as string }
  }

  const token = generatePublicAccessToken()
  const { data: updated, error: updateError } = await supabase
    .from("sale_orders")
    .update({ public_access_token: token })
    .eq("id", orderId)
    .select("public_access_token")
    .single()

  if (updateError || !updated?.public_access_token) {
    return {
      error:
        publicTokenSchemaError(updateError?.message) ||
        updateError?.message ||
        "Failed to create public link",
    }
  }

  return { token: updated.public_access_token as string }
}

export async function getOrderByPublicToken(token: string) {
  if (!isValidPublicAccessToken(token)) return { error: "Invalid order link" }

  // Disambiguate site_id vs owner_site_id FKs to sites.
  const supabase = await createServiceClient(true)
  const { data: order, error } = await supabase
    .from("sale_orders")
    .select("*, sale_order_items(*), site:sites!site_id(id, name, logo_url, url)")
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

  let lead: any = null
  if (order.sale_id) {
    const { data: saleData } = await supabase
      .from("sales")
      .select("leads(id, name, email)")
      .eq("id", order.sale_id)
      .single()
    lead = saleData?.leads || null
  }

  const branding = await loadSiteBranding(supabase, order.site_id || order.owner_site_id)
  return {
    data: {
      ...order,
      items: order.sale_order_items || [],
      leads: lead,
      site: Array.isArray(order.site) ? order.site[0] : order.site,
    },
    branding,
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
  if (order.sale_id) {
    const { data: saleData } = await supabase
      .from("sales")
      .select("leads(id, name, email)")
      .eq("id", order.sale_id)
      .single()
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
  const docRef = String(order.order_number || order.id).substring(0, 12)
  const currency = order.currency || "USD"
  const totalLabel = formatDocumentMoney(Number(order.total) || 0, currency, locale)
  const siteName = site?.name || "Order"
  const items = (order.sale_order_items || []).map((item: any) => ({
    name: item.name || "Item",
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    subtotal: Number(item.subtotal) || 0,
  }))

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
    return {
      error: publicTokenSchemaError(stampError.message) || stampError.message,
    }
  }

  return { success: true, data: { ...updated, leads: lead }, emailed: true }
}
