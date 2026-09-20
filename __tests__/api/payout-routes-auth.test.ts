/** @jest-environment node */

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { POST as requestPayout } from "@/app/api/payouts/request/route"
import { POST as resolvePayout } from "@/app/api/payouts/resolve/route"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const payoutId = "00000000-0000-4000-8000-000000000002"

function request(body: Record<string, unknown>) {
  const bytes = Buffer.from(JSON.stringify(body))
  let consumed = false
  return {
    url: "https://example.test/api/payouts/request",
    headers: {
      get: jest.fn((name: string) => {
        if (name.toLowerCase() === "cookie") return "sb-access-token=test"
        if (name.toLowerCase() === "content-length") return String(bytes.length)
        return null
      }),
    },
    body: {
      getReader: () => ({
        read: jest.fn(async () => {
          if (consumed) return { done: true, value: undefined }
          consumed = true
          return { done: false, value: bytes }
        }),
        cancel: jest.fn(),
      }),
    },
    json: async () => body,
  } as any
}

function userClient(
  user: unknown,
  membership?: { data: unknown; error: unknown },
  platformRole?: string | null
) {
  const membershipQuery: any = {}
  membershipQuery.select = jest.fn(() => membershipQuery)
  membershipQuery.eq = jest.fn(() => membershipQuery)
  membershipQuery.single = jest.fn().mockResolvedValue({
    data: {
      shop: {
        bank_account_name: "Test",
        bank_name: "Test Bank",
        bank_routing_number: "123",
        bank_account_number: "456",
      },
    },
    error: null,
  })

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc: jest.fn((name: string) =>
      Promise.resolve({
        data:
          name === "current_user_platform_role"
            ? platformRole ?? null
            : (membership?.data as { role?: string } | undefined)?.role ?? null,
        error: membership?.error ?? null,
      })
    ),
    from: jest.fn(() => membershipQuery),
  }
}

describe("payout route authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("rejects unauthenticated payout requests before elevated access", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(userClient(null))

    const response = await requestPayout(request({
      siteId,
      requestedCredits: 100,
      idempotencyKey: "payout-request-test-key",
    }))

    expect(response.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("rejects read-only site members before elevated access", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient(
        { id: "user-1" },
        { data: { role: "marketing" }, error: null }
      )
    )

    const response = await requestPayout(request({
      siteId,
      requestedCredits: 100,
      idempotencyKey: "payout-request-test-key",
    }))

    expect(response.status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("creates an owner payout request through the atomic RPC", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient(
        { id: "owner-1" },
        { data: { role: "owner" }, error: null }
      )
    )
    const serviceClient = {
      rpc: jest.fn().mockResolvedValue({
        data: { id: payoutId, site_id: siteId, status: "pending" },
        error: null,
      }),
    }
    ;(createServiceClient as jest.Mock).mockResolvedValue(serviceClient)

    const response = await requestPayout(
      request({
        siteId,
        requestedCredits: 100,
        idempotencyKey: "payout-request-test-key",
      })
    )

    expect(response.status).toBe(200)
    expect(serviceClient.rpc).toHaveBeenCalledWith("create_payout_request", {
      p_site_id: siteId,
      p_requested_credits: 100,
      p_bank_details: {
        accountName: "Test",
        bankName: "Test Bank",
        routingNumber: "123",
        accountNumber: "456",
      },
      p_requested_by: "owner-1",
      p_idempotency_key: "payout-request-test-key",
    })
  })

  it("rejects unauthenticated payout resolution before elevated access", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(userClient(null))

    const response = await resolvePayout(request({
      payoutId,
      status: "completed",
    }))

    expect(response.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("rejects an ordinary authenticated user resolving an arbitrary payout", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({ id: "user-1", app_metadata: {} })
    )
    ;(createServiceClient as jest.Mock).mockImplementation(() => {
      throw new Error("Service-role access must happen after platform authorization")
    })

    const response = await resolvePayout(request({
      payoutId,
      status: "completed",
    }))

    expect(response.status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("allows a trusted finance administrator to resolve a pending payout", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({
        id: "finance-user",
      }, undefined, "finance_admin")
    )

    const serviceClient = {
      rpc: jest.fn().mockResolvedValue({
        data: {
          id: payoutId,
          site_id: siteId,
          status: "completed",
        },
        error: null,
      }),
    }
    ;(createServiceClient as jest.Mock).mockResolvedValue(serviceClient)

    const response = await resolvePayout(
      request({ payoutId, status: "completed" })
    )

    expect(response.status).toBe(200)
    expect(createServiceClient).toHaveBeenCalledTimes(1)
    expect(serviceClient.rpc).toHaveBeenCalledWith("resolve_payout_request", {
      p_payout_id: payoutId,
      p_status: "completed",
      p_resolved_by: "finance-user",
    })
  })
})
