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
import {
  formatDocumentMoney,
  documentT,
} from "@/app/lib/i18n/document-t"
import { loadSiteBranding, publicTokenSchemaError } from "@/app/documents/site-branding"
import { getSaleOrderBySaleId } from "@/app/sales/actions"

export async function ensureSalePublicAccessToken(saleId: string) {
  const supabase = await createClient()
  const { data: sale, error } = await supabase
    .from("sales")
    .select("id, public_access_token")
    .eq("id", saleId)
    .single()

  if (error || !sale) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Sale not found",
    }
  }

  if (sale.public_access_token && isValidPublicAccessToken(sale.public_access_token)) {
    return { token: sale.public_access_token as string }
  }

  const token = generatePublicAccessToken()
  const { data: updated, error: updateError } = await supabase
    .from("sales")
    .update({ public_access_token: token })
    .eq("id", saleId)
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

export async function getSaleByPublicToken(token: string) {
  if (!isValidPublicAccessToken(token)) return { error: "Invalid invoice link" }

  const supabase = await createServiceClient(true)
  const { data: sale, error } = await supabase
    .from("sales")
    .select("*, leads(id, name, email), site:sites!site_id(id, name, logo_url, url)")
    .eq("public_access_token", token)
    .single()

  if (error || !sale) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Invoice not found",
    }
  }

  if (sale.status === "cancelled") {
    return { error: "This invoice is no longer available" }
  }

  const [orderRes, branding] = await Promise.all([
    supabase
      .from("sale_orders")
      .select("*, sale_order_items(*)")
      .eq("sale_id", sale.id)
      .maybeSingle(),
    loadSiteBranding(supabase, sale.site_id),
  ])

  const order = orderRes.data
    ? {
        ...orderRes.data,
        items: orderRes.data.sale_order_items || orderRes.data.items || [],
      }
    : null

  return { data: sale, saleOrder: order, branding }
}

export async function sendSaleInvoice(id: string) {
  const supabase = await createClient()
  const { data: sale, error } = await supabase
    .from("sales")
    .select("*, leads(id, name, email), site:sites!site_id(id, name, logo_url, url)")
    .eq("id", id)
    .single()

  if (error || !sale) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Sale not found",
    }
  }
  if (sale.status === "cancelled") return { error: "Cancelled sales cannot be emailed" }

  const toEmail = sale.leads?.email?.trim()
  if (!toEmail) return { error: "Client email is required to send this invoice" }

  const mailConfig = getSendGridConfig()
  if (!mailConfig) {
    return { error: "Email is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL)" }
  }

  const branding = await loadSiteBranding(supabase, sale.site_id)
  const joinedSite = Array.isArray(sale.site) ? sale.site[0] : sale.site
  const site = joinedSite || branding.site
  const locale = branding.locale

  const tokenRes = await ensureSalePublicAccessToken(id)
  if (tokenRes.error || !tokenRes.token) {
    return { error: tokenRes.error || "Failed to create public invoice link" }
  }

  const viewLink = buildPublicDocUrl("i", tokenRes.token)
  const docRef = (sale.invoice_number || sale.id).toString().substring(0, 12)
  const currency = sale.currency || "USD"
  const totalLabel = formatDocumentMoney(Number(sale.amount) || 0, currency, locale)
  const siteName = site?.name || "Invoice"

  const orderRes = await getSaleOrderBySaleId(sale.site_id, sale.id)
  const orderItems = orderRes.saleOrder?.items || []
  const items =
    orderItems.length > 0
      ? orderItems.map((item: any) => ({
          name: item.name || "Item",
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unitPrice ?? item.unit_price) || 0,
          subtotal: Number(item.subtotal) || 0,
        }))
      : [
          {
            name: sale.product_name || sale.title || "Sale",
            quantity: 1,
            unit_price: Number(sale.amount) || 0,
            subtotal: Number(sale.amount) || 0,
          },
        ]

  const pdfBytes = await buildDocumentPdf({
    docKindLabel: documentT(locale, "invoice") || "Invoice",
    docRef,
    title: sale.title,
    status: sale.status,
    currency,
    created_at: sale.sale_date || sale.created_at,
    subtotal: orderRes.saleOrder?.subtotal ?? sale.amount,
    tax_total: orderRes.saleOrder?.taxTotal ?? 0,
    discount_total: orderRes.saleOrder?.discountTotal ?? 0,
    total: orderRes.saleOrder?.total ?? sale.amount,
    items,
    party: { name: sale.leads?.name, email: sale.leads?.email },
    site,
    location: branding.location,
    locale,
    viewLink,
    reviewLabelKey: "documents.reviewOnline",
    statusKind: "sales",
  })

  const emailResult = await sendDocumentEmailViaSendGrid({
    toEmail,
    toName: sale.leads?.name,
    fromEmail: mailConfig.fromEmail,
    fromName: mailConfig.fromName || siteName,
    subject: buildDocumentEmailSubject({
      siteName,
      docRef,
      locale,
      i18nPrefix: "sales",
    }),
    siteName,
    docRef,
    totalLabel,
    viewLink,
    pdfBase64: uint8ToBase64(pdfBytes),
    pdfFilename: `invoice-${docRef}.pdf`,
    apiKey: mailConfig.apiKey,
    locale,
    i18nPrefix: "sales",
  })

  if ("error" in emailResult) return { error: emailResult.error }

  const now = new Date().toISOString()
  const { data: updated, error: stampError } = await supabase
    .from("sales")
    .update({ last_emailed_at: now })
    .eq("id", id)
    .select("*, leads(id, name, email)")
    .single()

  if (stampError) {
    return {
      error: publicTokenSchemaError(stampError.message) || stampError.message,
    }
  }

  return { success: true, data: updated, emailed: true }
}
