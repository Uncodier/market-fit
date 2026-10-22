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

beforeEach(() => {
  fetchNodes = jest.fn().mockResolvedValue({ data: [node("existing")], error: null })
  jest.mocked(createClient).mockReturnValue({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, not: () => query,
        order: () => query, in: () => Promise.resolve({ data: [], error: null }),
        range: () => fetchNodes(),
        then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
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