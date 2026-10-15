import { executeMarketplaceOrderAction, type OrderActionDependencies } from "@/lib/marketplace/order-action"
import { MarketplaceProviderError } from "@/lib/marketplace/providers/types"

function fixture() {
  const metadata = { state: "pending", sync_status: "confirmed", capabilities: { accept: true } }
  const input = { action: "accept" as const, cooking_time_minutes: 15 }
  const dependencies: OrderActionDependencies = {
    claim: jest.fn(async () => ({ action_id: "test-action", acquired: true })),
    perform: jest.fn(async () => ({ action: "accept" as const, external_order_id: "test-order", acknowledged: true as const })),
    finish: jest.fn(async () => undefined),
  }
  return { metadata, input, dependencies }
}

describe("durable marketplace order operations", () => {
  it("claims once before dispatch and commits provider confirmation", async () => {
    const { metadata, input, dependencies } = fixture()
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({
      success: true, operation: { status: "confirmed", action: "accept" },
    })
    expect(dependencies.finish).toHaveBeenCalledWith("test-action", "confirmed", input)
    expect((dependencies.claim as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (dependencies.perform as jest.Mock).mock.invocationCallOrder[0],
    )
  })
  it("does not dispatch when another request owns the action", async () => {
    const { metadata, input, dependencies } = fixture()
    dependencies.claim = jest.fn(async () => ({ action_id: "existing", acquired: false, status: "pending" as const }))
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({ success: false })
    expect(dependencies.perform).not.toHaveBeenCalled()
  })
  it("persists unknown outcomes instead of retrying requests", async () => {
    const { metadata, input, dependencies } = fixture()
    dependencies.perform = jest.fn(async () => { throw new MarketplaceProviderError("timeout", "Timed out") })
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({
      success: false, operation: { status: "unknown" },
    })
    expect(dependencies.perform).toHaveBeenCalledTimes(1)
    expect(dependencies.finish).toHaveBeenCalledWith("test-action", "unknown", input)
  })
  it("does not report successful acceptance when local confirmation fails", async () => {
    const { metadata, input, dependencies } = fixture()
    dependencies.finish = jest.fn(async () => { throw new Error("Commit failed") })
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({
      success: false, operation: { status: "unknown" },
    })
  })
  it("preserves definitive provider rejections separately from uncertainty", async () => {
    const { metadata, input, dependencies } = fixture()
    dependencies.perform = jest.fn(async () => { throw new MarketplaceProviderError("http_error", "Invalid", 400) })
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({
      success: false, operation: { status: "failed" },
    })
  })
  it("does not allow a second action while confirmation is uncertain", async () => {
    const { metadata, input, dependencies } = fixture()
    await expect(executeMarketplaceOrderAction({ ...metadata, sync_status: "unknown" }, input, dependencies))
      .rejects.toMatchObject({ status: 409 })
    expect(dependencies.claim).not.toHaveBeenCalled()
  })
  it("returns the committed outcome when a concurrent webhook supersedes the action", async () => {
    const { metadata, input, dependencies } = fixture()
    dependencies.finish = jest.fn(async () => "failed" as const)
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({
      success: false, operation: { status: "failed" },
    })
  })
  it("treats an HTTP request timeout as uncertain, not safe to resend", async () => {
    const { metadata, input, dependencies } = fixture()
    dependencies.perform = jest.fn(async () => { throw new MarketplaceProviderError("http_error", "Timeout", 408) })
    await expect(executeMarketplaceOrderAction(metadata, input, dependencies)).resolves.toMatchObject({
      success: false, operation: { status: "unknown" },
    })
  })
})