import { resolveImprentaSync } from "@/app/lib/imprenta-instance-sync"
import type { InstanceNode } from "@/app/types/instance-nodes"

describe("resolveImprentaSync", () => {
  let actions: any

  beforeEach(() => {
    actions = {
      resetEphemeralState: jest.fn(),
      setNodes: jest.fn(),
      setContexts: jest.fn(),
    }
  })

  it("should hydrate on mount if data is already in cache (SWR cache hit)", () => {
    const data = { nodes: [{ id: "n1" } as InstanceNode], contexts: [{ id: "c1" }] }
    
    const res = resolveImprentaSync(
      "inst-1",
      data,
      null, // currentSyncedInstanceId
      null, // currentRequestedInstanceId
      actions
    )

    expect(actions.resetEphemeralState).toHaveBeenCalledTimes(1)
    expect(actions.setNodes).toHaveBeenCalledWith(data.nodes)
    expect(actions.setContexts).toHaveBeenCalledWith(data.contexts)
    expect(res).toEqual({ syncedId: "inst-1", requestedId: "inst-1" })
  })

  it("should reset and stay null if instance changed but no data is available yet", () => {
    const res = resolveImprentaSync(
      "inst-2",
      undefined,
      "inst-1", // currentSyncedInstanceId
      "inst-1", // currentRequestedInstanceId
      actions
    )

    expect(actions.resetEphemeralState).toHaveBeenCalledTimes(1)
    expect(actions.setNodes).toHaveBeenCalledWith([])
    expect(actions.setContexts).toHaveBeenCalledWith([])
    expect(res).toEqual({ syncedId: null, requestedId: "inst-2" })
  })

  it("should hydrate if data arrives later for the requested instance", () => {
    const data = { nodes: [{ id: "n2" } as InstanceNode], contexts: [] }
    
    const res = resolveImprentaSync(
      "inst-2",
      data,
      null,     // currentSyncedInstanceId
      "inst-2", // currentRequestedInstanceId
      actions
    )

    // It should not reset ephemeral state again when data arrives
    expect(actions.resetEphemeralState).not.toHaveBeenCalled()
    expect(actions.setNodes).toHaveBeenCalledWith(data.nodes)
    expect(actions.setContexts).toHaveBeenCalledWith(data.contexts)
    expect(res).toEqual({ syncedId: "inst-2", requestedId: "inst-2" })
  })

  it("should ignore subsequent data updates (realtime handles them) if already synced", () => {
    const data = { nodes: [{ id: "n2-updated" } as InstanceNode], contexts: [] }
    
    const res = resolveImprentaSync(
      "inst-2",
      data,
      "inst-2", // currentSyncedInstanceId
      "inst-2", // currentRequestedInstanceId
      actions
    )

    expect(actions.resetEphemeralState).not.toHaveBeenCalled()
    expect(actions.setNodes).not.toHaveBeenCalled()
    expect(actions.setContexts).not.toHaveBeenCalled()
    expect(res).toEqual({ syncedId: "inst-2", requestedId: "inst-2" })
  })

  it("should clear everything if activeInstanceId becomes undefined", () => {
    const res = resolveImprentaSync(
      undefined,
      undefined,
      "inst-1",
      "inst-1",
      actions
    )

    expect(actions.resetEphemeralState).toHaveBeenCalledTimes(1)
    expect(actions.setNodes).toHaveBeenCalledWith([])
    expect(actions.setContexts).toHaveBeenCalledWith([])
    expect(res).toEqual({ syncedId: null, requestedId: null })
  })
})
