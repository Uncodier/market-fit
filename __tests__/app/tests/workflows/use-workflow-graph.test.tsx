import { act, renderHook } from "@testing-library/react"
import { apiClient } from "@/app/services/api-client-service"
import { toast } from "sonner"
import type { InstanceNode } from "@/app/types/instance-nodes"

const mockedClient = {
  auth: { getSession: jest.fn() },
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn(),
}

jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockedClient }))

const { useWorkflowGraph } = require("@/app/components/workflows/use-workflow-graph") as typeof import("@/app/components/workflows/use-workflow-graph")

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

const trigger = {
  id: "trigger-1", type: "wf-trigger", parent_node_id: null, instance_id: "instance-1", site_id: "site-1",
} as InstanceNode
const step = {
  id: "step-1", type: "wf-step", parent_node_id: "trigger-1", instance_id: "instance-1", site_id: "site-1",
} as InstanceNode

describe("useWorkflowGraph sync", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockedClient.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } })
    mockedClient.channel.mockReturnValue({ on: () => ({ subscribe: () => ({}) }) })
    mockedClient.removeChannel.mockResolvedValue(undefined)
    const selection: any = {
      in: () => selection,
      order: async () => ({ data: [trigger, step], error: null }),
    }
    const mutate = (data: InstanceNode) => ({ select: () => ({ single: async () => ({ data, error: null }) }) })
    const update = (patch: Partial<InstanceNode>) => {
      const updated = { ...step, ...patch }
      const selection: any = {
        eq: () => selection,
        in: () => Promise.resolve({ error: null }),
        select: () => ({ single: async () => ({ data: updated, error: null }) }),
      }
      return selection
    }
    mockedClient.from.mockReturnValue({
      select: () => ({ eq: () => selection }),
      insert: () => mutate(step),
      update,
      delete: () => {
        const selection: any = { eq: () => selection, then: (resolve: (value: { error: null }) => void) => Promise.resolve({ error: null }).then(resolve) }
        return selection
      },
    })
    jest.spyOn(apiClient, "post").mockResolvedValue({ success: true })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("refreshes the workflow definition after a step is created, edited and deleted", async () => {
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.createNode({ type: "wf-step", parentId: "trigger-1", position: { x: 800, y: 80 }, title: "Step" })
      jest.advanceTimersByTime(1000)
    })
    expect(apiClient.post).toHaveBeenCalledWith("/api/workflows/instance-1/sync-triggers", {})
    await act(async () => {
      await result.current.updateNode("step-1", { prompt: { text: "New instructions" } })
      jest.advanceTimersByTime(1000)
    })
    expect(apiClient.post).toHaveBeenCalledTimes(2)
    await act(async () => {
      await result.current.deleteNode("step-1")
      jest.advanceTimersByTime(1000)
    })
    expect(apiClient.post).toHaveBeenCalledTimes(3)
  })

  it("gives newly created linked steps an on success relation", async () => {
    const insert = jest.fn(() => ({ select: () => ({ single: async () => ({ data: step, error: null }) }) }))
    mockedClient.from.mockImplementation(() => ({
      select: () => ({ eq: () => {
        const selection: any = { in: () => selection, order: async () => ({ data: [trigger], error: null }) }
        return selection
      } }),
      insert,
    }))
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.createNode({ type: "wf-step", parentId: "trigger-1", position: { x: 800, y: 80 }, title: "Follow up" })
    })
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({
      parent_node_id: "trigger-1",
      settings: expect.objectContaining({ relation_context: "on success" }),
    })])
  })

  it("shows an error when an edited trigger could not be synchronized", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    jest.spyOn(apiClient, "post").mockResolvedValue({ success: false, error: { message: "Not permitted" } })
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.updateNode("step-1", { prompt: { text: "Updated" } })
      jest.advanceTimersByTime(1000)
    })
    expect(toast.error).toHaveBeenCalledWith("Not permitted")
  })

  it("persists reconnection and disconnection, and rejects cycles before writing", async () => {
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.setStepParent("step-1", null)
    })
    expect(mockedClient.from).toHaveBeenCalledWith("instance_nodes")
    expect(result.current.nodes.find((node: InstanceNode) => node.id === "step-1")?.parent_node_id).toBeNull()
    await act(async () => {
      await result.current.setStepParent("step-1", "trigger-1")
    })
    expect(result.current.nodes.find((node: InstanceNode) => node.id === "step-1")?.parent_node_id).toBe("trigger-1")
    expect(result.current.nodes.find((node: InstanceNode) => node.id === "step-1")?.settings.relation_context).toBe("on success")
    await expect(result.current.setStepParent("step-1", "step-1")).rejects.toThrow("Cannot connect")
    await expect(result.current.setStepParent("trigger-1", "step-1")).rejects.toThrow("Cannot connect")
  })

  it("saves relation context on the child and refreshes the workflow definition", async () => {
    const update = jest.fn((patch: Partial<InstanceNode>) => {
      const chain: any = { eq: () => chain, select: () => ({ maybeSingle: async () => ({ data: { ...step, ...patch }, error: null }) }) }
      return chain
    })
    const selection: any = { in: () => selection, order: async () => ({ data: [trigger, step], error: null }) }
    mockedClient.from.mockReturnValue({ select: () => ({ eq: () => selection }), update })
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.setRelationContext("step-1", "on fail")
      jest.advanceTimersByTime(1000)
    })
    expect(update).toHaveBeenCalledWith({ settings: { relation_context: "on fail" } })
    expect(result.current.nodes.find((node: InstanceNode) => node.id === "step-1")?.settings.relation_context).toBe("on fail")
    expect(apiClient.post).toHaveBeenCalledWith("/api/workflows/instance-1/sync-triggers", {})
    await expect(result.current.setRelationContext("trigger-1", "always")).rejects.toThrow("Cannot update")
    await expect(result.current.setRelationContext("step-1", "x".repeat(121))).rejects.toThrow("Cannot update")
  })

  it("detaches direct children before deleting their parent, leaving descendants intact", async () => {
    const child = { ...step, id: "child", parent_node_id: "step-1" }
    const selection: any = {
      in: () => selection,
      order: async () => ({ data: [trigger, step, child], error: null }),
    }
    const update = jest.fn(() => {
      const chain: any = { eq: () => chain, in: async () => ({ error: null }) }
      return chain
    })
    const deleteRow = jest.fn(() => {
      const chain: any = { eq: () => chain, then: (resolve: (value: { error: null }) => void) => Promise.resolve({ error: null }).then(resolve) }
      return chain
    })
    mockedClient.from.mockReturnValue({ select: () => ({ eq: () => selection }), update, delete: deleteRow })
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => { await result.current.deleteNode("step-1") })
    expect(update).toHaveBeenCalledWith({ parent_node_id: null })
    expect(deleteRow).toHaveBeenCalledTimes(1)
    expect(result.current.nodes.map((node: InstanceNode) => [node.id, node.parent_node_id])).toEqual([
      ["trigger-1", null], ["child", null],
    ])
  })

  it("shows detached children during a stale realtime reload after deletion", async () => {
    const selection: any = {
      in: () => selection,
      order: async () => ({ data: [trigger, step], error: null }),
    }
    const update = () => {
      const chain: any = { eq: () => chain, in: async () => ({ error: null }) }
      return chain
    }
    const deleteRow = () => {
      const chain: any = { eq: () => chain, then: (resolve: (value: { error: null }) => void) => Promise.resolve({ error: null }).then(resolve) }
      return chain
    }
    mockedClient.from.mockReturnValue({ select: () => ({ eq: () => selection }), update, delete: deleteRow })
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.deleteNode("trigger-1")
      await result.current.reload()
    })
    expect(result.current.nodes.map((node: InstanceNode) => [node.id, node.parent_node_id])).toEqual([["step-1", null]])
  })

  it("restores children if deleting their parent fails", async () => {
    const selection: any = {
      in: () => selection,
      order: async () => ({ data: [trigger, step], error: null }),
    }
    const update = jest.fn(() => {
      const chain: any = { eq: () => chain, in: async () => ({ error: null }) }
      return chain
    })
    const deleteRow = () => {
      const chain: any = { eq: () => chain, then: (resolve: (value: { error: Error }) => void) => Promise.resolve({ error: new Error("Delete failed") }).then(resolve) }
      return chain
    }
    mockedClient.from.mockReturnValue({ select: () => ({ eq: () => selection }), update, delete: deleteRow })
    const { result } = renderHook(() => useWorkflowGraph("instance-1", "site-1"))
    await act(async () => { await Promise.resolve() })
    await act(async () => { await expect(result.current.deleteNode("trigger-1")).rejects.toThrow("Delete failed") })
    expect(update).toHaveBeenCalledWith({ parent_node_id: null })
    expect(update).toHaveBeenCalledWith({ parent_node_id: "trigger-1" })
    await act(async () => { await Promise.resolve() })
    expect(result.current.nodes.find((node: InstanceNode) => node.id === "step-1")?.parent_node_id).toBe("trigger-1")
  })
})