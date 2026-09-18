import AdminPayoutsPage from "@/app/admin/payouts/page"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

jest.mock("@/app/admin/payouts/components/PayoutAdminClient", () => ({
  PayoutAdminClient: () => null,
}))

function userClient(user: unknown, platformRole: string | null = null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({
      data: platformRole,
      error: null,
    }),
  }
}

describe("admin payouts page authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("redirects unauthenticated users before elevated access", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(userClient(null))

    await expect(AdminPayoutsPage()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/login"
    )
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("redirects ordinary users before elevated access", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({ id: "user-1" })
    )

    await expect(AdminPayoutsPage()).rejects.toThrow("NEXT_REDIRECT:/")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("loads payouts for a trusted finance administrator", async () => {
    ;(createClient as jest.Mock).mockResolvedValue(
      userClient({ id: "finance-1" }, "finance_admin")
    )

    const query: any = {}
    query.select = jest.fn(() => query)
    query.eq = jest.fn(() => query)
    query.order = jest.fn().mockResolvedValue({ data: [], error: null })
    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn(() => query),
    })

    await expect(AdminPayoutsPage()).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
    expect(createServiceClient).toHaveBeenCalledTimes(1)
  })
})
