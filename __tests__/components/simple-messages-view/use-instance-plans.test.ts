import { act, renderHook, waitFor } from "@testing-library/react"
import { createClient } from "@/lib/supabase/client"
import { useInstancePlans } from "@/app/components/simple-messages-view/hooks/useInstancePlans"

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}))

type QueryResult = { data: Record<string, unknown>[]; error: null }

describe("useInstancePlans", () => {
  it("ignores an older request after the active instance changes", async () => {
    const pending = new Map<string, (result: QueryResult) => void>()
    const client = {
      from: jest.fn(() => {
        let instanceId = ""
        let orderCount = 0
        const query: {
          select: jest.Mock
          eq: jest.Mock
          order: jest.Mock
        } = {
          select: jest.fn(() => query),
          eq: jest.fn((_column: string, value: string) => {
            instanceId = value
            return query
          }),
          order: jest.fn(() => {
            orderCount += 1
            if (orderCount === 1) return query
            return new Promise<QueryResult>((resolve) => {
              pending.set(instanceId, resolve)
            })
          }),
        }
        return query
      }),
      channel: jest.fn(() => {
        const channel: { on: jest.Mock; subscribe: jest.Mock } = {
          on: jest.fn((): typeof channel => channel),
          subscribe: jest.fn(() => channel),
        }
        return channel
      }),
      removeChannel: jest.fn(),
    }
    jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const { result, rerender } = renderHook(
      ({ instanceId }) =>
        useInstancePlans({ activeRobotInstance: { id: instanceId } }),
      { initialProps: { instanceId: "instance-a" } }
    )

    await waitFor(() => expect(pending.has("instance-a")).toBe(true))
    const oldInstanceRefresh = result.current.loadInstancePlans
    rerender({ instanceId: "instance-b" })
    await waitFor(() => expect(pending.has("instance-b")).toBe(true))
    const calls = client.from.mock.calls.length
    await act(async () => { expect(await oldInstanceRefresh()).toBe(false) })
    expect(client.from.mock.calls.length).toBe(calls)

    await act(async () => {
      pending.get("instance-b")?.({
        data: [{
          id: "plan-b",
          title: "Plan B",
          plan_type: "task",
          priority: 1,
          status: "pending",
          progress_percentage: 0,
          steps_completed: 0,
          steps_total: 0,
          instance_id: "instance-b",
          created_at: "2026-09-22T12:00:00.000Z",
          steps: [],
          metadata: {},
        }],
        error: null,
      })
    })

    await waitFor(() =>
      expect(result.current.instancePlans.map((plan) => plan.id)).toEqual(["plan-b"])
    )

    await act(async () => {
      pending.get("instance-a")?.({
        data: [{
          id: "plan-a",
          title: "Plan A",
          plan_type: "task",
          priority: 1,
          status: "pending",
          progress_percentage: 0,
          steps_completed: 0,
          steps_total: 0,
          instance_id: "instance-a",
          created_at: "2026-09-22T11:00:00.000Z",
          steps: [],
          metadata: {},
        }],
        error: null,
      })
    })

    expect(result.current.instancePlans.map((plan) => plan.id)).toEqual(["plan-b"])
  })
  it("preserves visible plans and reports refresh failure without a Realtime event", async () => {
    const outcome = { data: [{ id: "plan-a",title: "Plan A",status: "paused",created_at: "2026-10-13T00:00:00Z",
      steps: [{ id: "step_1",status: "in_progress" }],metadata: {} }],error: null as null | { code: string } }
    const query = { select: jest.fn(),eq: jest.fn(),order: jest.fn() }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    let orders = 0
    query.order.mockImplementation(() => ++orders % 2 === 1 ? query : Promise.resolve(outcome))
    const channel = { on: jest.fn(),subscribe: jest.fn() }
    channel.on.mockReturnValue(channel); channel.subscribe.mockReturnValue(channel)
    jest.mocked(createClient).mockReturnValue({ from: () => query,channel: () => channel,removeChannel: jest.fn() } as unknown as ReturnType<typeof createClient>)
    jest.spyOn(console,"error").mockImplementation(() => {})
    const { result } = renderHook(() => useInstancePlans({ activeRobotInstance: { id: "instance-a" } }))
    await waitFor(() => expect(result.current.instancePlans).toHaveLength(1))
    outcome.error = { code: "57014" }
    await act(async () => { expect(await result.current.loadInstancePlans()).toBe(false) })
    expect(result.current.instancePlans[0].id).toBe("plan-a")
    expect(result.current.steps).toHaveLength(1)
    expect(result.current.isLoadingPlans).toBe(false)
    jest.restoreAllMocks()
  })
})
