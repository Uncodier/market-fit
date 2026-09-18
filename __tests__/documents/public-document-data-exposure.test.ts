import { createServiceClient } from "@/lib/supabase/server"
import { loadSiteBranding } from "@/app/documents/site-branding"
import { getOrderByPublicToken } from "@/app/orders/send-actions"
import { getSaleByPublicToken } from "@/app/sales/send-actions"
import { getBillByPublicToken } from "@/app/bills/send-actions"
import { getQuotationByPublicToken } from "@/app/quotations/public-actions"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

jest.mock("@/app/documents/site-branding", () => ({
  loadSiteBranding: jest.fn(),
  publicTokenSchemaError: jest.fn(() => null),
}))

jest.mock("@/app/documents/send-document-email", () => ({
  buildDocumentEmailSubject: jest.fn(),
  getSendGridConfig: jest.fn(),
  sendDocumentEmailViaSendGrid: jest.fn(),
}))

jest.mock("@/app/documents/document-pdf", () => ({
  buildDocumentPdf: jest.fn(),
  uint8ToBase64: jest.fn(),
}))

jest.mock("@/app/sales/actions", () => ({
  getSaleOrderBySaleId: jest.fn(),
}))

jest.mock("stripe", () => jest.fn())

const token = "0123456789abcdefghijklmn"

const branding = {
  site: {
    id: "site-1",
    name: "Example Store",
    logo_url: "https://example.com/logo.png",
    url: "https://example.com",
  },
  locale: "en",
  location: {
    id: "location-internal",
    name: "Main Store",
    address: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    country: "US",
    metadata: { private: true },
  },
}

function query(result: unknown) {
  const response =
    result &&
    typeof result === "object" &&
    ("data" in result || "error" in result)
      ? result
      : { data: result, error: null }
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(response)
  builder.maybeSingle = jest.fn().mockResolvedValue(response)
  return builder
}

function deepKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(deepKeys)
  if (!value || typeof value !== "object") return []

  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...deepKeys(nested),
  ])
}

function expectNoPrivateFields(
  value: unknown,
  options: { allowCheckoutMetadata?: boolean } = {}
) {
  const forbiddenFields = [
      "payment_details",
      "payments",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "user_id",
      "buyer_user_id",
      "owner_site_id",
      "sale_id",
      "lead_id",
      "vendor_company_id",
      "quotation_id",
      "purchase_id",
      "public_access_token",
      "public_access_token_expires_at",
      "public_access_token_revoked_at",
      "internal_notes",
      "private",
    ]
  if (!options.allowCheckoutMetadata) forbiddenFields.push("metadata")
  expect(deepKeys(value)).not.toEqual(expect.arrayContaining(forbiddenFields))
}

function expectExplicitProjection(
  builder: ReturnType<typeof query>,
  forbiddenFields: string[]
) {
  const projection = builder.select.mock.calls[0][0] as string
  expect(projection).not.toContain("*")
  for (const field of forbiddenFields) {
    expect(projection).not.toContain(field)
  }
}

describe("public document data exposure", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(loadSiteBranding as jest.Mock).mockResolvedValue(branding)
  })

  it("returns only the order fields used by the public order page", async () => {
    const orderQuery = query({
      id: "order-1",
      site_id: "site-1",
      owner_site_id: "owner-site-internal",
      sale_id: "sale-1",
      order_number: "SO-100",
      status: "pending",
      currency: "USD",
      created_at: "2026-09-17T12:00:00.000Z",
      subtotal: 20,
      tax_total: 2,
      discount_total: 1,
      total: 21,
      fulfillment_method: "ship",
      shipping_address: {
        line1: "456 Buyer Ave",
        city: "Austin",
        state: "TX",
        zip: "78702",
        country: "US",
        internal_notes: "do not expose",
      },
      public_access_token_expires_at: null,
      public_access_token_revoked_at: null,
      sale_order_items: [{
        id: "order-item-internal",
        name: "Widget",
        quantity: 2,
        unit_price: 10,
        subtotal: 20,
        status: "pending",
        metadata: { private: true },
      }],
      sales: {
        id: "sale-1",
        status: "pending",
        amount_due: 21,
        payment_method: "card",
        payment_details: { secret: true },
        payments: [{ id: "payment-internal" }],
        stripe_checkout_session_id: "cs_secret",
        stripe_payment_intent_id: "pi_secret",
        leads: {
          id: "lead-internal",
          name: "Buyer",
          email: "buyer@example.com",
        },
      },
      site: branding.site,
      user_id: "seller-internal",
      metadata: { private: true },
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => orderQuery),
    })

    const result = await getOrderByPublicToken(token)
    const data = (result as any).data

    expectExplicitProjection(orderQuery, [
      "payment_details",
      "payments",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "metadata",
    ])
    expect(Object.keys(data)).toEqual([
      "id",
      "order_number",
      "status",
      "currency",
      "created_at",
      "subtotal",
      "tax_total",
      "discount_total",
      "total",
      "fulfillment_method",
      "shipping_address",
      "items",
      "leads",
      "sales",
      "site",
    ])
    expect(data.items).toEqual([{
      name: "Widget",
      quantity: 2,
      unit_price: 10,
      subtotal: 20,
      status: "pending",
    }])
    expect(data.sales).toEqual({
      status: "pending",
      amount_due: 21,
      payment_method: "card",
    })
    expectNoPrivateFields(result)
  })

  it("returns only invoice display, checkout, and line-item fields", async () => {
    const saleQuery = query({
      id: "sale-1",
      site_id: "site-1",
      title: "Invoice",
      product_name: "Consulting",
      invoice_number: "INV-100",
      status: "pending",
      amount: 100,
      amount_due: 40,
      currency: "USD",
      sale_date: "2026-09-16",
      created_at: "2026-09-16T12:00:00.000Z",
      public_access_token_expires_at: null,
      public_access_token_revoked_at: null,
      leads: { id: "lead-internal", name: "Buyer", email: "buyer@example.com" },
      site: branding.site,
      payment_details: { secret: true },
      payments: [{ id: "payment-internal" }],
      stripe_checkout_session_id: "cs_secret",
      stripe_payment_intent_id: "pi_secret",
      user_id: "seller-internal",
    })
    const orderQuery = query({
      subtotal: 90,
      tax_total: 10,
      discount_total: 0,
      total: 100,
      sale_order_items: [{
        id: "order-item-internal",
        name: "Consulting",
        quantity: 1,
        unit_price: 90,
        subtotal: 90,
        status: "pending",
        metadata: { private: true },
      }],
      metadata: { private: true },
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) =>
        table === "sales" ? saleQuery : orderQuery
      ),
    })

    const result = await getSaleByPublicToken(token)
    const data = (result as any).data

    expectExplicitProjection(saleQuery, [
      "payment_details",
      "payments",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "metadata",
    ])
    expectExplicitProjection(orderQuery, ["metadata"])
    expect(Object.keys(data)).toEqual([
      "id",
      "title",
      "product_name",
      "invoice_number",
      "status",
      "amount",
      "amount_due",
      "currency",
      "sale_date",
      "created_at",
      "leads",
      "site",
    ])
    expect((result as any).saleOrder.items).toEqual([{
      name: "Consulting",
      quantity: 1,
      unit_price: 90,
      subtotal: 90,
      status: "pending",
    }])
    expectNoPrivateFields(result)
  })

  it("returns a sanitized bill view without the raw purchase", async () => {
    const billQuery = query({
      id: "purchase-1",
      site_id: "site-1",
      title: "Paper",
      status: "pending",
      amount: 75,
      currency: "USD",
      purchase_date: "2026-09-15",
      created_at: "2026-09-15T12:00:00.000Z",
      public_access_token_expires_at: null,
      public_access_token_revoked_at: null,
      vendor: {
        id: "vendor-internal",
        name: "Vendor",
        email: "vendor@example.com",
      },
      purchase_items: [{
        id: "purchase-item-internal",
        name: "Paper",
        quantity: 3,
        unit_cost: 25,
        subtotal: 75,
        metadata: { private: true },
      }],
      site: branding.site,
      payments: [{ id: "payment-internal" }],
      user_id: "seller-internal",
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => billQuery),
    })

    const result = await getBillByPublicToken(token)
    const data = (result as any).data

    expectExplicitProjection(billQuery, ["payments", "metadata", "user_id"])
    expect(result).not.toHaveProperty("raw")
    expect(Object.keys(data)).toEqual([
      "id",
      "title",
      "status",
      "amount",
      "currency",
      "purchaseDate",
      "createdAt",
      "vendorName",
      "vendorEmail",
      "items",
      "site",
    ])
    expect(data.items).toEqual([{
      name: "Paper",
      quantity: 3,
      unitCost: 25,
      subtotal: 75,
    }])
    expectNoPrivateFields(result)
  })

  it("returns only quote display and checkout fields without unrelated metadata", async () => {
    const quoteQuery = query({
      id: "quote-1",
      site_id: "site-1",
      title: "Project quote",
      status: "sent",
      valid_until: "2026-10-17T12:00:00.000Z",
      currency: "USD",
      notes: "Public terms",
      subtotal: 200,
      discount_total: 10,
      tax_total: 20,
      total: 210,
      created_at: "2026-09-17T12:00:00.000Z",
      public_access_token_expires_at: null,
      public_access_token_revoked_at: null,
      items: [{
        id: "quote-item-internal",
        quotation_id: "quote-1",
        catalog_item_id: "catalog-1",
        name: "Service",
        quantity: 2,
        unit_price: 100,
        subtotal: 200,
        metadata: { private: true },
        catalog_item: {
          id: "catalog-1",
          site_id: "site-1",
          name: "Service",
          image_url: "https://example.com/service.png",
          kind: "service",
          digital_subtype: null,
          currency: "USD",
          is_recurring: false,
          is_reservation: true,
          is_dynamic_price: false,
          metadata: {
            delivery_options: ["pickup", "ship", 7],
            pickup_location_ids: ["location-1", 9],
            payment_options: ["card"],
            shipping_cost: 12,
            shipping_cost_mode: "extra",
            private: true,
          },
        },
      }],
      lead: {
        id: "lead-internal",
        buyer_user_id: "buyer-internal",
        name: "Buyer",
        email: "buyer@example.com",
      },
      site: branding.site,
      deal_id: "deal-internal",
      price_list_id: "price-list-internal",
      user_id: "seller-internal",
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => quoteQuery),
    })

    const result = await getQuotationByPublicToken(token)
    const data = (result as any).data

    expectExplicitProjection(quoteQuery, [
      "buyer_user_id",
      "lead_id",
      "deal_id",
      "price_list_id",
      "user_id",
    ])
    expect(Object.keys(data)).toEqual([
      "id",
      "site_id",
      "title",
      "status",
      "valid_until",
      "currency",
      "notes",
      "subtotal",
      "discount_total",
      "tax_total",
      "total",
      "created_at",
      "items",
      "lead",
      "site",
    ])
    expect(data.items[0]).toEqual({
      catalog_item_id: "catalog-1",
      name: "Service",
      quantity: 2,
      unit_price: 100,
      subtotal: 200,
      catalog_item: {
        name: "Service",
        image_url: "https://example.com/service.png",
        kind: "service",
        digital_subtype: null,
        currency: "USD",
        is_recurring: false,
        is_reservation: true,
        is_dynamic_price: false,
        metadata: {
          delivery_options: ["pickup", "ship"],
          pickup_location_ids: ["location-1"],
          payment_options: ["card"],
          shipping_cost: 12,
          shipping_cost_mode: "extra",
        },
      },
    })
    expectNoPrivateFields(result, { allowCheckoutMetadata: true })
  })
})
