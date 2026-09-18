import { createServiceClient } from "@/lib/supabase/server"
import { POST as createOrderCheckout } from "@/app/api/stripe/checkout/order/route"
import { POST as createSaleCheckout } from "@/app/api/stripe/checkout/sale/route"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}))

jest.mock("stripe", () => {
  const mockSessionCreate = jest.fn()
  const mockSessionRetrieve = jest.fn()
  const mockSessionExpire = jest.fn()
  return Object.assign(
    jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockSessionCreate,
          retrieve: mockSessionRetrieve,
          expire: mockSessionExpire,
        },
      },
    })),
    { mockSessionCreate, mockSessionRetrieve, mockSessionExpire }
  )
})

const createStripeSession = jest.requireMock("stripe").mockSessionCreate
const retrieveStripeSession = jest.requireMock("stripe").mockSessionRetrieve
const expireStripeSession = jest.requireMock("stripe").mockSessionExpire

const orderId = "00000000-0000-4000-8000-000000000001"
const saleId = "00000000-0000-4000-8000-000000000002"
const siteId = "00000000-0000-4000-8000-000000000003"
const token = "0123456789abcdefghijklmn"

function request(body: Record<string, unknown>) {
  return {
    json: async () => body,
    headers: new Headers({ origin: "https://app.example.com" }),
  } as Request
}

function query(result: unknown) {
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  return builder
}

function successfulCheckoutRpc(attempt = 1) {
  return jest.fn(async (name: string) => {
    if (name === "reserve_stripe_checkout_attempt") {
      return { data: { status: "reserved", attempt }, error: null }
    }
    if (name === "link_stripe_checkout_session") {
      return { data: { status: "linked" }, error: null }
    }
    throw new Error(`Unexpected RPC: ${name}`)
  })
}

describe("public Stripe checkout authorization", () => {
  const originalReturnOrigins = process.env.CHECKOUT_RETURN_ORIGINS

  beforeEach(() => {
    jest.clearAllMocks()
    createStripeSession.mockResolvedValue({
      id: "cs_test_new",
      status: "open",
      url: "https://checkout.stripe.test/session",
    })
    expireStripeSession.mockResolvedValue({ status: "expired" })
    process.env.CHECKOUT_RETURN_ORIGINS = "https://app.example.com"
  })

  afterAll(() => {
    if (originalReturnOrigins === undefined) {
      delete process.env.CHECKOUT_RETURN_ORIGINS
    } else {
      process.env.CHECKOUT_RETURN_ORIGINS = originalReturnOrigins
    }
  })

  it("rejects order checkout without a public token before service access", async () => {
    const response = await createOrderCheckout(request({
      orderId,
      returnUrl: "https://app.example.com/so/token",
    }))

    expect(response.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("binds order checkout to the supplied public token", async () => {
    const orderQuery = query({ data: null, error: { message: "not found" } })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => orderQuery),
    })

    const response = await createOrderCheckout(request({
      orderId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/so/${token}`,
    }))

    expect(response.status).toBe(404)
    expect(orderQuery.eq).toHaveBeenNthCalledWith(1, "id", orderId)
    expect(orderQuery.eq).toHaveBeenNthCalledWith(2, "public_access_token", token)
    expect(createStripeSession).not.toHaveBeenCalled()
  })

  it("rejects invoice checkout without a public token before service access", async () => {
    const response = await createSaleCheckout(request({
      saleId,
      returnUrl: "https://app.example.com/i/token",
    }))

    expect(response.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("rejects a revoked order token before creating a Stripe session", async () => {
    const orderQuery = query({
      data: {
        id: orderId,
        public_access_token: token,
        public_access_token_revoked_at: "2026-09-17T12:00:00.000Z",
      },
      error: null,
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => orderQuery),
    })

    const response = await createOrderCheckout(request({
      orderId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/so/${token}`,
    }))

    expect(response.status).toBe(410)
    expect(createStripeSession).not.toHaveBeenCalled()
  })

  it("rejects a completed invoice with no outstanding balance", async () => {
    const saleQuery = query({
      data: {
        id: saleId,
        site_id: siteId,
        public_access_token: token,
        status: "completed",
        amount: 100,
        amount_due: 0,
      },
      error: null,
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => saleQuery),
    })

    const response = await createSaleCheckout(request({
      saleId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/i/${token}`,
    }))

    expect(response.status).toBe(409)
    expect(createStripeSession).not.toHaveBeenCalled()
  })

  it("charges a completed-but-unpaid order using the sale balance", async () => {
    const orderQuery = query({
      data: {
        id: orderId,
        order_number: "SO-100",
        status: "completed",
        currency: "USD",
        site_id: siteId,
        owner_site_id: null,
        buyer_user_id: "buyer-a",
        sale_id: saleId,
        public_access_token_expires_at: null,
        public_access_token_revoked_at: null,
      },
      error: null,
    })
    const saleQuery = query({
      data: {
        id: saleId,
        status: "completed",
        amount_due: 12.5,
        currency: "USD",
        stripe_checkout_session_id: null,
        lead_id: null,
      },
      error: null,
    })
    const rpc = successfulCheckoutRpc(4)
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "sale_orders") return orderQuery
        return saleQuery
      }),
      rpc,
    })

    const response = await createOrderCheckout(request({
      orderId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/so/${token}`,
    }))

    expect(response.status).toBe(200)
    expect(createStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "usd",
              unit_amount: 1250,
            }),
          }),
        ],
      }),
      expect.objectContaining({
        idempotencyKey: `public-checkout:sale:${saleId}:4:usd:1250`,
      })
    )
    expect(rpc).toHaveBeenCalledWith("link_stripe_checkout_session", {
      p_sale_id: saleId,
      p_attempt: 4,
      p_session_id: "cs_test_new",
      p_amount_minor: 1250,
      p_currency: "usd",
    })
  })

  it("rejects an order whose currency differs from its sale", async () => {
    const orderQuery = query({
      data: {
        id: orderId,
        status: "pending",
        currency: "MXN",
        site_id: siteId,
        sale_id: saleId,
      },
      error: null,
    })
    const saleQuery = query({
      data: {
        id: saleId,
        status: "pending",
        amount_due: 12.5,
        currency: "USD",
        stripe_checkout_session_id: null,
      },
      error: null,
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) =>
        table === "sale_orders" ? orderQuery : saleQuery
      ),
      rpc: successfulCheckoutRpc(),
    })

    const response = await createOrderCheckout(request({
      orderId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/so/${token}`,
    }))

    expect(response.status).toBe(409)
    expect(createStripeSession).not.toHaveBeenCalled()
  })

  it("reuses an open checkout session with the same balance", async () => {
    const saleQuery = query({
      data: {
        id: saleId,
        site_id: siteId,
        public_access_token: token,
        status: "pending",
        amount_due: 25,
        currency: "USD",
        stripe_checkout_session_id: "cs_test_open",
      },
      error: null,
    })
    const orderQuery = query({ data: null, error: null })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) =>
        table === "sale_orders" ? orderQuery : saleQuery
      ),
    })
    retrieveStripeSession.mockResolvedValue({
      id: "cs_test_open",
      status: "open",
      amount_total: 2500,
      currency: "usd",
      metadata: { sale_id: saleId },
      url: "https://checkout.stripe.test/existing",
    })

    const response = await createSaleCheckout(request({
      saleId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/i/${token}`,
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://checkout.stripe.test/existing")
    expect(createStripeSession).not.toHaveBeenCalled()
  })

  it("permits a completed invoice that still has an outstanding balance", async () => {
    const saleQuery = query({
      data: {
        id: saleId,
        site_id: siteId,
        public_access_token: token,
        status: "completed",
        amount: 100,
        amount_due: 25,
        currency: "USD",
        stripe_checkout_session_id: null,
        leads: { email: "buyer@example.com" },
      },
      error: null,
    })
    const orderQuery = query({ data: null, error: null })
    const rpc = successfulCheckoutRpc(2)
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "sale_orders") return orderQuery
        return saleQuery
      }),
      rpc,
    })

    const response = await createSaleCheckout(request({
      saleId,
      publicAccessToken: token,
      siteId: "attacker-site",
      returnUrl: `https://app.example.com/i/${token}`,
      successUrl: `https://app.example.com/i/${token}?paid=true`,
    }))

    expect(response.status).toBe(200)
    expect(createStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: `https://app.example.com/i/${token}?paid=true`,
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 2500 }),
          }),
        ],
        metadata: expect.objectContaining({ site_id: siteId, sale_id: saleId }),
      }),
      expect.objectContaining({
        idempotencyKey: `public-checkout:sale:${saleId}:2:usd:2500`,
      })
    )
    expect(rpc).toHaveBeenCalledWith("reserve_stripe_checkout_attempt", {
      p_sale_id: saleId,
      p_amount_minor: 2500,
      p_currency: "usd",
      p_expected_session_id: null,
    })
  })

  it("expires a new session when atomic persistence fails", async () => {
    const saleQuery = query({
      data: {
        id: saleId,
        site_id: siteId,
        public_access_token: token,
        status: "pending",
        amount_due: 25,
        currency: "USD",
        stripe_checkout_session_id: null,
      },
      error: null,
    })
    const orderQuery = query({ data: null, error: null })
    const rpc = jest.fn(async (name: string) => ({
      data: name === "reserve_stripe_checkout_attempt"
        ? { status: "reserved", attempt: 9 }
        : { status: "rejected", reason: "stale_attempt" },
      error: null,
    }))
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) =>
        table === "sale_orders" ? orderQuery : saleQuery
      ),
      rpc,
    })

    const response = await createSaleCheckout(request({
      saleId,
      publicAccessToken: token,
      returnUrl: `https://app.example.com/i/${token}`,
    }))

    expect(response.status).toBe(500)
    expect(expireStripeSession).toHaveBeenCalledWith("cs_test_new")
    expect(createStripeSession).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: `public-checkout:sale:${saleId}:9:usd:2500` },
    )
  })

  it("rejects cross-origin checkout redirects", async () => {
    const response = await createOrderCheckout(request({
      orderId,
      publicAccessToken: token,
      returnUrl: "https://attacker.example/complete",
    }))

    expect(response.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("does not trust an arbitrary Origin header as an allowlist", async () => {
    const forgedRequest = {
      json: async () => ({
        orderId,
        publicAccessToken: token,
        returnUrl: "https://attacker.example/complete",
      }),
      url: "https://app.makinari.com/api/stripe/checkout/order",
      headers: new Headers({ origin: "https://attacker.example" }),
    } as Request

    const response = await createOrderCheckout(forgedRequest)

    expect(response.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("requires redirects to stay on the exact initiating origin", async () => {
    const response = await createOrderCheckout({
      json: async () => ({
        orderId,
        publicAccessToken: token,
        returnUrl: `https://www.makinari.com/so/${token}`,
      }),
      url: "https://app.makinari.com/api/stripe/checkout/order",
      headers: new Headers({ origin: "https://app.makinari.com" }),
    } as Request)

    expect(response.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
