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
import { mapPurchase } from "@/app/purchases/purchase-mappers"

export async function ensureBillPublicAccessToken(purchaseId: string) {
  const supabase = await createClient()
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("id, public_access_token")
    .eq("id", purchaseId)
    .single()

  if (error || !purchase) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Bill not found",
    }
  }

  if (
    purchase.public_access_token &&
    isValidPublicAccessToken(purchase.public_access_token)
  ) {
    return { token: purchase.public_access_token as string }
  }

  const token = generatePublicAccessToken()
  const { data: updated, error: updateError } = await supabase
    .from("purchases")
    .update({ public_access_token: token })
    .eq("id", purchaseId)
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

export async function getBillByPublicToken(token: string) {
  if (!isValidPublicAccessToken(token)) return { error: "Invalid bill link" }

  const supabase = await createServiceClient(true)
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      *,
      vendor:companies!vendor_company_id(id, name, email),
      purchase_items(*, catalog_items(id, name, kind)),
      site:sites!site_id(id, name, logo_url, url)
    `)
    .eq("public_access_token", token)
    .single()

  if (error || !data) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Bill not found",
    }
  }

  if (data.status === "cancelled") {
    return { error: "This bill is no longer available" }
  }

  const branding = await loadSiteBranding(supabase, data.site_id)
  return { data: mapPurchase(data), raw: data, branding }
}

export async function sendVendorBill(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      *,
      vendor:companies!vendor_company_id(id, name, email),
      purchase_items(*, catalog_items(id, name, kind)),
      site:sites!site_id(id, name, logo_url, url)
    `)
    .eq("id", id)
    .single()

  if (error || !data) {
    return {
      error:
        publicTokenSchemaError(error?.message) ||
        error?.message ||
        "Bill not found",
    }
  }
  if (data.status === "cancelled") return { error: "Cancelled bills cannot be emailed" }

  const vendor = Array.isArray(data.vendor) ? data.vendor[0] : data.vendor
  const toEmail = vendor?.email?.trim()
  if (!toEmail) return { error: "Vendor email is required to send this bill" }

  const mailConfig = getSendGridConfig()
  if (!mailConfig) {
    return { error: "Email is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL)" }
  }

  const branding = await loadSiteBranding(supabase, data.site_id)
  const joinedSite = Array.isArray(data.site) ? data.site[0] : data.site
  const site = joinedSite || branding.site
  const locale = branding.locale

  const tokenRes = await ensureBillPublicAccessToken(id)
  if (tokenRes.error || !tokenRes.token) {
    return { error: tokenRes.error || "Failed to create public bill link" }
  }

  const viewLink = buildPublicDocUrl("vb", tokenRes.token)
  const docRef = String(data.id).substring(0, 8)
  const currency = data.currency || "USD"
  const totalLabel = formatDocumentMoney(Number(data.amount) || 0, currency, locale)
  const siteName = site?.name || "Bill"
  const items = (data.purchase_items || []).map((item: any) => ({
    name: item.name || item.catalog_items?.name || "Item",
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_cost ?? item.unit_price) || 0,
    subtotal: Number(item.subtotal) || 0,
  }))

  const pdfBytes = await buildDocumentPdf({
    docKindLabel: documentT(locale, "bills.detail.breadcrumb") || "Bill",
    docRef,
    title: data.title,
    status: data.status,
    currency,
    created_at: data.purchase_date || data.created_at,
    subtotal: data.amount,
    tax_total: 0,
    discount_total: 0,
    total: data.amount,
    items,
    party: { name: vendor?.name, email: vendor?.email },
    site,
    location: branding.location,
    locale,
    viewLink,
    reviewLabelKey: "documents.reviewOnline",
    statusKind: "bills",
  })

  const emailResult = await sendDocumentEmailViaSendGrid({
    toEmail,
    toName: vendor?.name,
    fromEmail: mailConfig.fromEmail,
    fromName: mailConfig.fromName || siteName,
    subject: buildDocumentEmailSubject({
      siteName,
      docRef,
      locale,
      i18nPrefix: "bills",
    }),
    siteName,
    docRef,
    totalLabel,
    viewLink,
    pdfBase64: uint8ToBase64(pdfBytes),
    pdfFilename: `bill-${docRef}.pdf`,
    apiKey: mailConfig.apiKey,
    locale,
    i18nPrefix: "bills",
  })

  if ("error" in emailResult) return { error: emailResult.error }

  const now = new Date().toISOString()
  const { data: updated, error: stampError } = await supabase
    .from("purchases")
    .update({ last_emailed_at: now })
    .eq("id", id)
    .select(`
      *,
      vendor:companies!vendor_company_id(id, name, email),
      purchase_items(*, catalog_items(id, name, kind))
    `)
    .single()

  if (stampError) {
    return {
      error: publicTokenSchemaError(stampError.message) || stampError.message,
    }
  }

  return { success: true, data: mapPurchase(updated), emailed: true }
}
