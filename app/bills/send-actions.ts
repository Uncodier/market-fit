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
import { documentT, formatDocumentMoney } from "@/app/lib/i18n/document-t"
import { loadSiteBranding, publicTokenSchemaError } from "@/app/documents/site-branding"
import { mapPurchase } from "@/app/purchases/purchase-mappers"

const PUBLIC_BILL_SELECT = `
  id,
  site_id,
  title,
  status,
  amount,
  currency,
  purchase_date,
  created_at,
  public_access_token_expires_at,
  public_access_token_revoked_at,
  vendor:companies!vendor_company_id(name, email),
  purchase_items(name, quantity, unit_cost, subtotal, catalog_items(name)),
  site:sites!site_id(id, name, logo_url, url)
`

export async function ensureBillPublicAccessToken(purchaseId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "purchases",
    purchaseId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) ||
        result.error ||
        "Bill not found",
    }
  }
  return result
}

export async function rotateBillPublicAccessToken(purchaseId: string) {
  const supabase = await createClient()
  const result = await ensurePublicAccessTokenForRecord(
    supabase,
    "purchases",
    purchaseId,
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

export async function revokeBillPublicAccessToken(purchaseId: string) {
  const supabase = await createClient()
  const result = await revokePublicAccessTokenForRecord(
    supabase,
    "purchases",
    purchaseId
  )
  if ("error" in result) {
    return {
      error:
        publicTokenSchemaError(result.error) || result.error,
    }
  }
  return result
}

export async function getBillByPublicToken(token: string) {
  if (!isValidPublicAccessToken(token)) return { error: "Invalid bill link" }

  const supabase = await createServiceClient(true)
  const { data, error } = await supabase
    .from("purchases")
    .select(PUBLIC_BILL_SELECT)
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
  if (!isPublicAccessTokenActive(data)) {
    return { error: "This bill link is no longer available" }
  }

  const branding = await loadSiteBranding(supabase, data.site_id)
  const vendor = Array.isArray(data.vendor) ? data.vendor[0] : data.vendor
  const site = Array.isArray(data.site) ? data.site[0] : data.site
  const items = (data.purchase_items || []).map((item: any) => {
    const catalog = Array.isArray(item.catalog_items)
      ? item.catalog_items[0]
      : item.catalog_items
    return {
      name: item.name || catalog?.name || "Item",
      quantity: Number(item.quantity) || 0,
      unitCost: Number(item.unit_cost) || 0,
      subtotal: Number(item.subtotal) || 0,
    }
  })
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
      id: data.id,
      title: data.title,
      status: data.status,
      amount: Number(data.amount) || 0,
      currency: data.currency || "USD",
      purchaseDate: data.purchase_date,
      createdAt: data.created_at,
      vendorName: vendor?.name ?? null,
      vendorEmail: vendor?.email ?? null,
      items,
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
    console.error("Bill email delivered but audit timestamp failed:", stampError)
    return {
      success: true,
      data: mapPurchase(data),
      emailed: true,
      auditRecorded: false,
      warning: "Email was delivered, but the delivery timestamp could not be saved.",
    }
  }

  return {
    success: true,
    data: mapPurchase(updated),
    emailed: true,
    auditRecorded: true,
  }
}
