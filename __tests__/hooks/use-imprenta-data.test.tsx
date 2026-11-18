import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { createClient } from "@/lib/supabase/client"
import { useImprentaData } from "@/app/hooks/useImprentaData"
import type { InstanceNode } from "@/app/types/instance-nodes"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

const node = (id: string, instanceId = "instance-a"): InstanceNode => ({
  id, instance_id: instanceId, site_id: "site-a", user_id: "user-a",
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null,
  type: "generate-image", status: "completed", prompt: { text: "Photo.png" },
  settings: { imprenta_source: "upload", media_type: "image" },
  result: { outputs: [{ url: "https://example.test/photo.png", type: "image" }] },
  created_at: "2026-10-22", updated_at: "2026-10-22",
})

function wrapper() {
  const cache = new Map()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  }
}

let fetchNodes: jest.Mock
let fetchContexts: jest.Mock
let fetchLogs: jest.Mock

beforeEach(() => {
  fetchNodes = jest.fn().mockResolvedValue({ data: [node("existing")], error: null })
  fetchContexts = jest.fn().mockResolvedValue({ data: [], error: null })
  fetchLogs = jest.fn().mockResolvedValue({ data: [], error: null })
  jest.mocked(createClient).mockReturnValue({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, not: () => query,
        order: () => query, in: () => query,
        range: (from: number, to: number) => table === "instance_nodes" ? fetchNodes(from, to)
          : table === "instance_node_contexts" ? fetchContexts(from, to) : fetchLogs(from, to),
        then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => fetchLogs().then(resolve, reject),
      }
      expect(["instance_nodes", "instance_node_contexts", "instance_logs"]).toContain(table)
      return query
    },
  } as unknown as ReturnType<typeof createClient>)
})

it("keeps a confirmed upload in the cache used when reopening the canvas", async () => {
  const cacheWrapper = wrapper()
  const { result, unmount } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: cacheWrapper })
  await waitFor(() => expect(result.current.nodes).toHaveLength(1))
  const uploaded = node("uploaded")
  await act(async () => { await result.current.cacheUploadedNode(uploaded) })
  expect(result.current.imprentaData?.nodes).toEqual([node("existing"), uploaded])
  await act(async () => { await result.current.cacheUploadedNode(uploaded) })
  expect(result.current.nodes).toHaveLength(2)
  unmount()
  fetchNodes.mockResolvedValue({ data: [node("existing"), uploaded], error: null })
  const reopened = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: cacheWrapper })
  expect(reopened.result.current.nodes.map(item => item.id)).toEqual(["existing", "uploaded"])
  await waitFor(() => expect(fetchNodes).toHaveBeenCalledTimes(2))
})

it('does not read any history for a visual-only canvas, including recovery refresh', async () => {
  const { result } = renderHook(() => useImprentaData('instance-a', 'site-a', true), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  expect(fetchLogs).not.toHaveBeenCalled()
  await act(async () => { await result.current.refreshImprentaData() })
  expect(fetchLogs).not.toHaveBeenCalled()
  // Explicit publication still requires its independent complete read.
  await act(async () => { await result.current.ensureImprentaLogs() })
  expect(fetchLogs).toHaveBeenCalledWith(0, 499)
})

it('loads audience display history when the graph actually needs it', async () => {
  fetchNodes.mockResolvedValue({ data: [{ ...node('audience'), type: 'generate-audience' }], error: null })
  const { result } = renderHook(() => useImprentaData('instance-a', 'site-a', true), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  expect(fetchLogs).toHaveBeenCalledTimes(1)
})

it('loads logs when a visual canvas gains a live audience node without losing its graph', async () => {
  const { result, rerender } = renderHook(({ demand }) => useImprentaData('instance-a', 'site-a', demand), {
    initialProps: { demand: true }, wrapper: wrapper(),
  })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  const graph = result.current.imprentaData
  expect(fetchLogs).not.toHaveBeenCalled()
  rerender({ demand: false })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  expect(result.current.imprentaData).toBe(graph)
  expect(fetchLogs).toHaveBeenCalledTimes(1)
})

it("allows concurrent publications to share a complete log read without cancelling either", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  const pending = deferred<ReadResult>()
  fetchLogs.mockReturnValue(pending.promise)
  let publications!: Promise<PromiseSettledResult<Record<string, unknown>[]>[]>
  act(() => {
    publications = Promise.allSettled([result.current.ensureImprentaLogs(), result.current.ensureImprentaLogs()])
  })
  await act(async () => { pending.resolve({ data: [{ id: "log" }], error: null }); await publications })
  expect(await publications).toEqual([
    { status: "fulfilled", value: [{ id: "log" }] },
    { status: "fulfilled", value: [{ id: "log" }] },
  ])
  expect(fetchLogs).toHaveBeenCalledTimes(2)
})

it("does not let a display refresh cancel an in-flight complete publish read", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  const pending = deferred<ReadResult>()
  fetchLogs.mockReturnValueOnce(pending.promise)
  let publish!: Promise<Record<string, unknown>[]>
  act(() => { publish = result.current.ensureImprentaLogs() })
  await act(async () => { await result.current.refreshImprentaData() })
  expect(fetchLogs).toHaveBeenCalledTimes(2)
  await act(async () => { pending.resolve({ data: [{ id: "complete-log" }], error: null }); await publish })
  await expect(publish).resolves.toEqual([{ id: "complete-log" }])
  expect(result.current.logs).toEqual([{ id: "complete-log" }])
})

it("does not substitute a pending display read for complete publish history", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  const display = deferred<ReadResult>()
  const complete = deferred<ReadResult>()
  fetchLogs.mockReturnValueOnce(display.promise).mockReturnValueOnce(complete.promise)
  await act(async () => { await result.current.refreshImprentaData() })
  let publish!: Promise<Record<string, unknown>[]>
  act(() => { publish = result.current.ensureImprentaLogs() })
  expect(fetchLogs).toHaveBeenLastCalledWith(0, 499)
  await act(async () => { complete.resolve({ data: [{ id: "complete-log" }], error: null }); await publish })
  await act(async () => { display.resolve({ data: [{ id: "older-display" }], error: null }) })
  expect(result.current.logs).toEqual([{ id: "complete-log" }])
  expect(result.current.isLogsReady).toBe(true)
})

it("clears an explicit graph failure after a successful SWR revalidation", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  const error = new Error("Offline")
  fetchNodes.mockResolvedValueOnce({ data: null, error })
  await act(async () => { await expect(result.current.refreshImprentaData({ includeLogs: false })).rejects.toBe(error) })
  expect(result.current.isGraphReady).toBe(false)
  await act(async () => { await result.current.mutateImprenta() })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  expect(result.current.graphError).toBeUndefined()
})

it.each([true, false])("discards a refresh started before an upload (includeLogs=%s)", async includeLogs => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.nodes).toHaveLength(1))
  let finish!: (value: { data: InstanceNode[]; error: null }) => void
  fetchNodes.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  let refresh!: ReturnType<typeof result.current.refreshImprentaData>
  act(() => { refresh = result.current.refreshImprentaData({ includeLogs }) })
  await waitFor(() => expect(fetchNodes).toHaveBeenCalledTimes(2))
  await act(async () => { await result.current.cacheUploadedNode(node("uploaded")) })
  let refreshed: Awaited<typeof refresh>
  await act(async () => {
    finish({ data: [node("existing")], error: null })
    refreshed = await refresh
  })
  expect(refreshed).toBeUndefined()
  expect(result.current.nodes.map(item => item.id)).toEqual(["existing", "uploaded"])
})

it("ignores a refresh for an instance that is no longer active", async () => {
  const { result, rerender } = renderHook(({ id }) => useImprentaData(id, "site-a"), {
    initialProps: { id: "instance-a" }, wrapper: wrapper(),
  })
  await waitFor(() => expect(result.current.nodes).toHaveLength(1))
  let finish!: (value: { data: InstanceNode[]; error: null }) => void
  fetchNodes.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  let refresh!: ReturnType<typeof result.current.refreshImprentaData>
  act(() => { refresh = result.current.refreshImprentaData({ includeLogs: false }) })
  fetchNodes.mockResolvedValue({ data: [node("other", "instance-b")], error: null })
  rerender({ id: "instance-b" })
  await waitFor(() => expect(result.current.nodes[0]?.id).toBe("other"))
  await act(async () => {
    finish({ data: [node("existing")], error: null })
    expect(await refresh).toBeUndefined()
  })
  expect(result.current.nodes[0]?.id).toBe("other")
})

it("rejects uploads from another instance or site without changing the cache", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.nodes).toHaveLength(1))
  await act(async () => {
    await result.current.cacheUploadedNode(node("foreign", "instance-b"))
    await result.current.cacheUploadedNode({ ...node("foreign"), site_id: "site-b" })
  })
  expect(result.current.nodes).toEqual([node("existing")])
})

it("uses a later server snapshot as the source of truth, including deletions", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.nodes).toHaveLength(1))
  await act(async () => { await result.current.cacheUploadedNode(node("uploaded")) })
  fetchNodes.mockResolvedValue({ data: [node("uploaded")], error: null })
  await act(async () => {
    const refreshed = await result.current.refreshImprentaData({ includeLogs: false })
    expect(refreshed?.nodes).toEqual([node("uploaded")])
  })
  expect(result.current.nodes).toEqual([node("uploaded")])
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

type ReadResult = { data: Record<string, unknown>[] | null; error: Error | null }

it("starts logs concurrently and publishes nodes with all contexts without waiting for logs", async () => {
  const pendingNodes = deferred<{ data: InstanceNode[]; error: null }>()
  const pendingContexts = deferred<ReadResult>()
  const pendingLogs = deferred<ReadResult>()
  fetchNodes.mockReturnValueOnce(pendingNodes.promise)
  fetchContexts.mockReturnValueOnce(pendingContexts.promise)
  fetchLogs.mockReturnValueOnce(pendingLogs.promise)
  const { result, rerender } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  const empty = { nodes: result.current.nodes, contexts: result.current.contexts, logs: result.current.logs }
  await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(1))
  expect(fetchContexts).not.toHaveBeenCalled()
  rerender()
  expect(result.current.nodes).toBe(empty.nodes)
  expect(result.current.contexts).toBe(empty.contexts)
  expect(result.current.logs).toBe(empty.logs)
  await act(async () => { pendingNodes.resolve({ data: [node("existing")], error: null }) })
  expect(result.current.imprentaData).toBeUndefined()
  expect(result.current.isGraphReady).toBe(false)
  const contexts = [{ id: "context", target_node_id: "existing", context_node_id: "source" }]
  await act(async () => { pendingContexts.resolve({ data: contexts, error: null }) })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  expect(result.current.isLoading).toBe(false)
  expect(result.current.contexts).toEqual(contexts)
  expect(result.current.isLogsReady).toBe(false)
  const graphSnapshot = result.current.imprentaData
  await act(async () => { pendingLogs.resolve({ data: [{ id: "log" }], error: null }) })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  expect(result.current.logs).toEqual([{ id: "log" }])
  expect(result.current.imprentaData).toBe(graphSnapshot)
})

it("keeps graph failures visible and never treats missing connections as ready", async () => {
  const error = new Error("Connections unavailable")
  fetchContexts.mockResolvedValue({ data: null, error })
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.graphError).toBe(error))
  expect(result.current.isGraphReady).toBe(false)
  expect(result.current.imprentaData).toBeUndefined()
  expect(result.current.isLogsReady).toBe(true)
})

it("requires every context page before declaring the graph ready", async () => {
  const firstPage = Array.from({ length: 500 }, (_, id) => ({ id: `context-${id}` }))
  const lastPage = deferred<ReadResult>()
  fetchContexts.mockResolvedValueOnce({ data: firstPage, error: null }).mockReturnValueOnce(lastPage.promise)
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(fetchContexts).toHaveBeenCalledTimes(2))
  expect(result.current.isGraphReady).toBe(false)
  expect(fetchContexts).toHaveBeenLastCalledWith(500, 999)
  await act(async () => { lastPage.resolve({ data: [{ id: "last-context" }], error: null }) })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  expect(result.current.contexts).toHaveLength(501)
})

it.each(["instance", "site"])("does not show logs from a retired %s scope", async scopeType => {
  const oldRead = deferred<ReadResult>()
  const newRead = deferred<ReadResult>()
  fetchLogs.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise)
  const { result, rerender } = renderHook(({ id, site }) => useImprentaData(id, site), {
    initialProps: { id: "instance-a", site: "site-a" }, wrapper: wrapper(),
  })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  const id = scopeType === "instance" ? "instance-b" : "instance-a"
  const site = scopeType === "site" ? "site-b" : "site-a"
  fetchNodes.mockResolvedValue({ data: [{ ...node("new", id), site_id: site }], error: null })
  rerender({ id, site })
  await waitFor(() => expect(result.current.nodes[0]?.id).toBe("new"))
  await act(async () => { oldRead.resolve({ data: [{ id: "old-log" }], error: null }) })
  expect(result.current.logs).toEqual([])
  expect(result.current.isLogsReady).toBe(false)
  await act(async () => { newRead.resolve({ data: [{ id: "new-log" }], error: null }) })
  await waitFor(() => expect(result.current.logs).toEqual([{ id: "new-log" }]))
})

it("does not fabricate log readiness after an initial or explicit read fails", async () => {
  const error = new Error("Logs unavailable")
  fetchLogs.mockResolvedValue({ data: null, error })
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.logsError).toBe(error))
  expect(result.current.isGraphReady).toBe(true)
  expect(result.current.isLogsReady).toBe(false)
  await act(async () => { await expect(result.current.ensureImprentaLogs()).rejects.toBe(error) })
  expect(result.current.isLogsReady).toBe(false)
  expect(result.current.logsError).toBe(error)
  fetchLogs.mockResolvedValue({ data: [], error: null })
  await act(async () => { await expect(result.current.ensureImprentaLogs()).resolves.toEqual([]) })
  expect(result.current.isLogsReady).toBe(true)
  expect(result.current.logsError).toBeUndefined()
})

it("reads complete fresh logs only on demand and rejects a failed later page", async () => {
  fetchLogs.mockResolvedValueOnce({ data: [{ id: "display-log" }], error: null })
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  expect(fetchLogs.mock.calls).toEqual([[]])
  const firstPage = Array.from({ length: 500 }, (_, id) => ({ id: `log-${id}` }))
  const error = new Error("Second page unavailable")
  fetchLogs.mockResolvedValueOnce({ data: firstPage, error: null }).mockResolvedValueOnce({ data: null, error })
  await act(async () => { await expect(result.current.ensureImprentaLogs()).rejects.toBe(error) })
  expect(fetchLogs.mock.calls.slice(1)).toEqual([[0, 499], [500, 999]])
  expect(result.current.logs).toEqual([{ id: "display-log" }])
  expect(result.current.isLogsReady).toBe(false)
  expect(result.current.logsError).toBe(error)
})

it("retires pending publish log reads across a scope round trip", async () => {
  const { result, rerender } = renderHook(({ id }) => useImprentaData(id, "site-a"), {
    initialProps: { id: "instance-a" }, wrapper: wrapper(),
  })
  await waitFor(() => expect(result.current.isLogsReady).toBe(true))
  const pending = deferred<ReadResult>()
  fetchLogs.mockReturnValueOnce(pending.promise)
  let read!: Promise<Record<string, unknown>[]>
  act(() => { read = result.current.ensureImprentaLogs() })
  const rejected = expect(read).rejects.toThrow(/superseded|changed/)
  rerender({ id: "instance-b" })
  rerender({ id: "instance-a" })
  await act(async () => {
    pending.resolve({ data: [{ id: "retired" }], error: null })
    await rejected
  })
  expect(result.current.logs).not.toEqual([{ id: "retired" }])
})

it("does not treat an upload-only cache as a complete graph", async () => {
  fetchNodes.mockReturnValue(new Promise(() => {}))
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await act(async () => { await result.current.cacheUploadedNode(node("uploaded")) })
  expect(result.current.nodes).toEqual([node("uploaded")])
  expect(result.current.isGraphReady).toBe(false)
})

it("refreshes graph independently while a requested log refresh is unresolved", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  const pending = deferred<ReadResult>()
  fetchLogs.mockReturnValueOnce(pending.promise)
  fetchNodes.mockResolvedValue({ data: [node("updated")], error: null })
  let refresh!: ReturnType<typeof result.current.refreshImprentaData>
  act(() => { refresh = result.current.refreshImprentaData() })
  await waitFor(() => expect(result.current.nodes[0]?.id).toBe("updated"))
  await expect(refresh).resolves.toMatchObject({ nodes: [node("updated")] })
  await act(async () => {
    pending.resolve({ data: [{ id: "updated-log" }], error: null })
  })
  await waitFor(() => expect(result.current.logs).toEqual([{ id: "updated-log" }]))
  const logCalls = fetchLogs.mock.calls.length
  await act(async () => { await result.current.refreshImprentaData({ includeLogs: false }) })
  expect(fetchLogs).toHaveBeenCalledTimes(logCalls)
})

it("still returns refreshed graph data when the independent log refresh fails", async () => {
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.isGraphReady).toBe(true))
  fetchNodes.mockResolvedValue({ data: [node("updated")], error: null })
  const error = new Error("Logs unavailable")
  fetchLogs.mockResolvedValue({ data: null, error })
  await act(async () => {
    expect((await result.current.refreshImprentaData())?.nodes).toEqual([node("updated")])
  })
  expect(result.current.logsError).toBe(error)
  expect(result.current.isGraphReady).toBe(true)
  expect(result.current.isLogsReady).toBe(false)
})

it("clears a graph read failure only after a successful complete retry", async () => {
  const error = new Error("Connections unavailable")
  fetchContexts.mockResolvedValue({ data: null, error })
  const { result } = renderHook(() => useImprentaData("instance-a", "site-a"), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.graphError).toBe(error))
  fetchContexts.mockResolvedValue({ data: [], error: null })
  await act(async () => { await result.current.refreshImprentaData({ includeLogs: false }) })
  expect(result.current.graphError).toBeUndefined()
  expect(result.current.isGraphReady).toBe(true)
})
