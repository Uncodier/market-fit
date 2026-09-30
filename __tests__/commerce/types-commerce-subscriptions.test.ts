/** @jest-environment node */
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revokeForSubscription } from "@/app/commerce/entitlements"
import { cancelBuyerSubscription, listBuyerSubscriptions } from "@/app/buyer/subscription-actions"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))
jest.mock("@/app/commerce/entitlements", () => ({ revokeForSubscription: jest.fn() }))

class Query<T> {
  readonly select = jest.fn(() => this)
  readonly eq = jest.fn(() => this)
  readonly is = jest.fn(() => this)
  readonly in = jest.fn(() => this)
  readonly range = jest.fn(() => this)
  readonly order = jest.fn(() => this)
  readonly single = jest.fn(() => this)
  readonly update = jest.fn(() => this)
  readonly then: Promise<{ data: T; error: null; count: number }>["then"]

  constructor(data: T, count = 0) {
    const promise = Promise.resolve({ data, error: null, count })
    this.then = promise.then.bind(promise)
  }
}

function authenticatedClient(userId: string | null = "buyer-1") {
  const client = {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: userId ? { user: { id: userId } } : null },
      }),
    },
    from: jest.fn(),
  }
  jest.mocked(createClient).mockResolvedValue(client)
  return client
}

describe("commerce subscription action extraction", () => {
  beforeEach(() => jest.clearAllMocks())

  it("does not access subscriptions or service role without a session", async () => {
    const client = authenticatedClient(null)
    await expect(listBuyerSubscriptions({})).resolves.toEqual({ error: "Not authenticated" })
    await expect(cancelBuyerSubscription("sub-1")).resolves.toEqual({ error: "Not authenticated" })
    expect(client.from).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(revokeForSubscription).not.toHaveBeenCalled()
  })

  it("denies an inactive foreign-site membership before service-role reads", async () => {
    const client = authenticatedClient()
    const site = new Query({
      id: "foreign-site", user_id: "other-owner",
      site_members: [{ user_id: "buyer-1", status: "inactive" }],
    })
    client.from.mockReturnValue(site)
    await expect(listBuyerSubscriptions({ scope: "site", ownerSiteId: "foreign-site" }))
      .resolves.toEqual({ error: "Not authorized for this site" })
    expect(site.eq).toHaveBeenCalledWith("id", "foreign-site")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("retains personal identity, owner filter, pagination and entitlement matching", async () => {
    authenticatedClient()
    const subscriptions = new Query([{ id: "sub-1" }, { id: "sub-2" }], 2)
    const entitlements = new Query([
      { id: "ent-1", source_id: "sub-1" },
      { id: "ent-2", source_id: "sub-2" },
    ])
    const service = { from: jest.fn((table: string) => table === "subscriptions" ? subscriptions : entitlements) }
    jest.mocked(createServiceClient).mockResolvedValue(service)

    const result = await listBuyerSubscriptions({ ownerSiteId: "personal", status: "active", page: 2, pageSize: 10 })
    expect(subscriptions.eq).toHaveBeenCalledWith("buyer_user_id", "buyer-1")
    expect(subscriptions.is).toHaveBeenCalledWith("owner_site_id", null)
    expect(subscriptions.eq).toHaveBeenCalledWith("status", "active")
    expect(subscriptions.range).toHaveBeenCalledWith(10, 19)
    expect(entitlements.in).toHaveBeenCalledWith("source_id", ["sub-1", "sub-2"])
    expect(entitlements.eq).toHaveBeenCalledWith("source_type", "subscription")
    expect(result).toEqual({
      count: 2,
      data: [
        { id: "sub-1", entitlements: [{ id: "ent-1", source_id: "sub-1" }] },
        { id: "sub-2", entitlements: [{ id: "ent-2", source_id: "sub-2" }] },
      ],
    })
  })

  it.each(["owner", "active member"])("allows site reads for the %s", async (role) => {
    const client = authenticatedClient()
    const site = new Query({
      id: "site-1", user_id: role === "owner" ? "buyer-1" : "owner-2",
      site_members: role === "active member" ? [{ user_id: "buyer-1", status: "active" }] : [],
    })
    client.from.mockReturnValue(site)
    const subscriptions = new Query([])
    jest.mocked(createServiceClient).mockResolvedValue({ from: jest.fn(() => subscriptions) })
    await expect(listBuyerSubscriptions({ scope: "site", ownerSiteId: "site-1" })).resolves.toEqual({ data: [], count: 0 })
    expect(subscriptions.eq).toHaveBeenCalledWith("owner_site_id", "site-1")
    expect(subscriptions.eq).not.toHaveBeenCalledWith("buyer_user_id", "buyer-1")
  })

  it("does not cancel or revoke a foreign personal subscription", async () => {
    const client = authenticatedClient()
    const subscription = new Query({ id: "sub-1", buyer_user_id: "buyer-2", owner_site_id: null, status: "active" })
    client.from.mockReturnValue(subscription)
    await expect(cancelBuyerSubscription("sub-1")).resolves.toEqual({ error: "Not authorized to cancel this subscription" })
    expect(subscription.update).not.toHaveBeenCalled()
    expect(revokeForSubscription).not.toHaveBeenCalled()
  })

  it("preserves the cancellation lifecycle guard", async () => {
    const client = authenticatedClient()
    const subscription = new Query({ id: "sub-1", buyer_user_id: "buyer-1", status: "cancelled" })
    client.from.mockReturnValue(subscription)
    await expect(cancelBuyerSubscription("sub-1")).resolves.toEqual({ error: "Subscription cannot be cancelled at this time" })
    expect(subscription.update).not.toHaveBeenCalled()
    expect(revokeForSubscription).not.toHaveBeenCalled()
  })

  it("updates an authorized subscription before revoking its entitlements", async () => {
    const client = authenticatedClient()
    const subscription = new Query({ id: "sub-1", buyer_user_id: "buyer-1", status: "active" })
    client.from.mockReturnValue(subscription)
    await expect(cancelBuyerSubscription("sub-1")).resolves.toEqual({ success: true })
    expect(subscription.update).toHaveBeenCalledWith({ status: "cancelled", updated_at: expect.any(String) })
    expect(subscription.eq).toHaveBeenLastCalledWith("id", "sub-1")
    expect(revokeForSubscription).toHaveBeenCalledWith("sub-1", true)
    expect(subscription.update.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(revokeForSubscription).mock.invocationCallOrder[0])
  })
})