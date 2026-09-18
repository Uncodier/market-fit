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
import {
  formatDocumentMoney,
  documentT,
} from "@/app/lib/i18n/document-t"
import { loadSiteBranding, publicTokenSchemaError } from "@/app/documents/site-branding"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { getSaleOrderBySaleId } from "@/app/sales/actions"

const PUBLIC_SALE_SELECT = `
  id,
  site_id,
  title,
  product_name,
  invoice_number,
  status,
  amount,
  amount_due,
  currency,
  sale_date,
  created_at,
  public_access_token_expires_at,
  public_access_token_revoked_at,
  leads(name, email),
  site:sites!site_id(id, name, logo_url, url)
`

const PUBLIC_SALE_ORDER_SELECT = `
  subtotal,
  tax_total,
  discount_total,
  total,
  items,
  sale_order_items(name, quantity, unit_price, subtotal, status)
`

export async function ensureSalePublicAccessToken(saleId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "sales",
    saleId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) ||
        result.error ||
        "Sale not found",
    }
  }
  return result
}

export async function rotateSalePublicAccessToken(saleId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "sales",
    saleId,
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

export async function revokeSalePublicAccessToken(saleId: string) {
  const supabase = await createClient()
  const result = await revokePublicAccessTokenForRecord(
    supabase,
    "sales",
    saleId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) || result.error,
    }
  }
  return result
}

export async function getSaleByPublicToken(token: string) {
  if (!isValidPublicAccessToken(token)) return { error: "Invalid invoice link" }

  const supabase = await createServiceClient(true)
  const { data: sale, error } = await supabase
    .from("sales")
    .select(PUBLIC_SALE_SELECT)
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
  if (!isPublicAccessTokenActive(sale)) {
    return { error: "This invoice link is no longer available" }
  }

  const [orderRes, branding] = await Promise.all([
    supabase
      .from("sale_orders")
      .select(PUBLIC_SALE_ORDER_SELECT)
      .eq("sale_id", sale.id)
      .maybeSingle(),
    loadSiteBranding(supabase, sale.site_id),
  ])

  const lead = Array.isArray(sale.leads) ? sale.leads[0] : sale.leads
  const site = Array.isArray(sale.site) ? sale.site[0] : sale.site
  const order = orderRes.data
    ? {
        subtotal: orderRes.data.subtotal,
        tax_total: orderRes.data.tax_total,
        discount_total: orderRes.data.discount_total,
        total: orderRes.data.total,
        items: mapDocumentLineItems(
          orderRes.data.sale_order_items?.length > 0
            ? orderRes.data.sale_order_items
            : orderRes.data.items || []
        ),
      }
    : null
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
      id: sale.id,
      title: sale.title,
      product_name: sale.product_name,
      invoice_number: sale.invoice_number,
      status: sale.status,
      amount: sale.amount,
      amount_due: sale.amount_due,
      currency: sale.currency,
      sale_date: sale.sale_date,
      created_at: sale.created_at,
      leads: lead ? { name: lead.name ?? null, email: lead.email ?? null } : null,
      site: site
        ? {
            id: site.id,
            name: site.name ?? null,
            logo_url: site.logo_url ?? null,
            url: site.url ?? null,
          }
        : null,
    },
    saleOrder: order,
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
  const checkoutLink =
    sale.status === "pending" && Number(sale.amount_due) > 0
      ? viewLink
      : null

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
    checkoutLink,
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
    console.error("Invoice email delivered but audit timestamp failed:", stampError)
    return {
      success: true,
      data: sale,
      emailed: true,
      auditRecorded: false,
      warning: "Email was delivered, but the delivery timestamp could not be saved.",
    }
  }

  return {
    success: true,
    data: updated,
    emailed: true,
    auditRecorded: true,
  }
}
