import React from "react"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { createClient } from "@/lib/supabase/client"
import { useInstanceLogs } from "@/app/components/simple-messages-view/hooks/useInstanceLogs"
import type { InstanceLog } from "@/app/components/simple-messages-view/types"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/components/simple-messages-view/hooks/subscribeInstanceLogsRealtime", () => ({
  ...jest.requireActual("@/app/components/simple-messages-view/hooks/subscribeInstanceLogsRealtime"),
  subscribeInstanceLogsRealtime: jest.fn(() => jest.fn()),
}))
jest.mock("@/app/components/simple-messages-view/hooks/use-live-instance-logs", () => ({
  useLiveInstanceLogs: jest.fn(),
}))

const INSTANCE_ID = "pagination-instance"
const SITE_ID = "pagination-site"
const PAGE_SIZE = 100
type OrderColumn = "created_at" | "id"
type LogRequest = {
  table: string
  fields?: string
  filters: Array<[keyof InstanceLog, string]>
  orders: Array<{ column: OrderColumn; ascending: boolean }>
  cursor?: string
  limit?: number
}

function makeLog(sequence: number, instanceId = INSTANCE_ID): InstanceLog {
  return {
    id: `10000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`,
    instance_id: instanceId,
    site_id: SITE_ID,
    log_type: "agent_action",
    level: "info",
    message: `Persisted log ${sequence}`,
    // Five rows share each timestamp, including both page boundaries.
    created_at: new Date(Date.UTC(2026, 8, 22, 12, 0, Math.floor((sequence - 1) / 5))).toISOString(),
  }
}

const chronologicalLogs = Array.from({ length: 203 }, (_, index) => makeLog(index + 1))
const latestPage = chronologicalLogs.slice(-PAGE_SIZE)

function mockDatabaseBoundary() {
  const requests: LogRequest[] = []
  const rows = [...chronologicalLogs, makeLog(999, "another-instance")]

  const client = {
    from: jest.fn((table: string) => {
      const request: LogRequest = { table, filters: [], orders: [] }
      requests.push(request)
      const query = {
        select(fields: string) {
          request.fields = fields
          return query
        },
        eq(column: keyof InstanceLog, value: string) {
          request.filters.push([column, value])
          return query
        },
        or(cursor: string) {
          request.cursor = cursor
          return query
        },
        order(column: OrderColumn, { ascending }: { ascending: boolean }) {
          request.orders.push({ column, ascending })
          return query
        },
        async limit(limit: number) {
          request.limit = limit
          let matching = rows.filter((row) =>
            request.filters.every(([column, value]) => row[column] === value)
          )
          if (request.cursor) {
            const cursor = /^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]+)\)$/.exec(request.cursor)
            if (!cursor || cursor[1] !== cursor[2]) {
              throw new Error(`Unexpected history cursor: ${request.cursor}`)
            }
            const [, timestamp, , id] = cursor
            matching = matching.filter((row) =>
              row.created_at < timestamp || (row.created_at === timestamp && row.id < id)
            )
          }
          matching.sort((left, right) => {
            for (const { column, ascending } of request.orders) {
              const comparison = left[column].localeCompare(right[column])
              if (comparison !== 0) return ascending ? comparison : -comparison
            }
            return 0
          })
          // A fresh response array matters because the hook reverses each page in place.
          return { data: matching.slice(0, limit), error: null }
        },
      }
      return query
    }),
  }
  jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return requests
}

async function mountLogs(requirementId?: string) {
  const requests = mockDatabaseBoundary()
  const cache = new Map()
  const activeRobotInstance = {
    id: INSTANCE_ID,
    status: "completed",
    ...(requirementId ? { requirement_id: requirementId } : {}),
  }
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SWRConfig value={{
        provider: () => cache,
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }}>
        {children}
      </SWRConfig>
    )
  }
  const hook = renderHook(() => useInstanceLogs({ activeRobotInstance, currentSiteId: SITE_ID }), {
    wrapper: Wrapper,
  })
  await waitFor(() => {
    expect(hook.result.current.isLoadingLogs).toBe(false)
    expect(hook.result.current.logs).toEqual(latestPage)
  })
  // Flush the hook's delayed initial scroll callback and all mount revalidation work.
  await act(async () => { await jest.advanceTimersByTimeAsync(100) })
  return { ...hook, requests }
}

function expectPageRequest(request: LogRequest, cursor?: string) {
  expect(request).toEqual(expect.objectContaining({
    table: "instance_logs",
    filters: [["instance_id", INSTANCE_ID]],
    orders: [
      { column: "created_at", ascending: false },
      { column: "id", ascending: false },
    ],
    limit: PAGE_SIZE,
  }))
  expect(request.cursor).toBe(cursor)
}

describe.each([
  { label: "with requirement_id", requirementId: "pagination-requirement" },
  { label: "without requirement_id", requirementId: undefined },
])("useInstanceLogs pagination $label", ({ requirementId }) => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it("returns the latest page chronologically without automatically requesting older logs", async () => {
    const { result, rerender, requests } = await mountLogs(requirementId)
    expect(result.current.logs).toEqual(latestPage)
    expect(result.current.hasMoreLogs).toBe(true)
    expect(result.current.isLoadingMore).toBe(false)

    rerender()
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000) })

    // SWR and the mount effect can both fetch the latest page; neither may fetch history.
    expect(requests.length).toBeGreaterThanOrEqual(1)
    for (const request of requests) expectPageRequest(request)
    expect(result.current.logs).toEqual(latestPage)
    expect(result.current.hasMoreLogs).toBe(true)
  })

  it("loads older pages only on demand using the oldest timestamp and ID, then stops after a short page", async () => {
    const { result, requests } = await mountLogs(requirementId)
    const initialRequestCount = requests.length
    for (const request of requests) expectPageRequest(request)
    const oldestLatestLog = latestPage[0]
    // The next older row has the same timestamp, so timestamp-only pagination would skip it.
    expect(chronologicalLogs[102].created_at).toBe(oldestLatestLog.created_at)

    await act(async () => { await result.current.loadMoreLogs() })

    expect(requests).toHaveLength(initialRequestCount + 1)
    expectPageRequest(
      requests[initialRequestCount],
      `created_at.lt.${oldestLatestLog.created_at},and(created_at.eq.${oldestLatestLog.created_at},id.lt.${oldestLatestLog.id})`
    )
    expect(result.current.logs).toEqual(chronologicalLogs.slice(3))
    expect(result.current.hasMoreLogs).toBe(true)
    expect(result.current.isLoadingMore).toBe(false)

    await act(async () => { await jest.advanceTimersByTimeAsync(60_000) })
    expect(requests).toHaveLength(initialRequestCount + 1)
    expect(result.current.logs).toHaveLength(200)

    const oldestLoadedLog = chronologicalLogs[3]
    expect(chronologicalLogs[2].created_at).toBe(oldestLoadedLog.created_at)
    await act(async () => { await result.current.loadMoreLogs() })

    expect(requests).toHaveLength(initialRequestCount + 2)
    expectPageRequest(
      requests[initialRequestCount + 1],
      `created_at.lt.${oldestLoadedLog.created_at},and(created_at.eq.${oldestLoadedLog.created_at},id.lt.${oldestLoadedLog.id})`
    )
    expect(result.current.logs).toEqual(chronologicalLogs)
    expect(new Set(result.current.logs.map((log) => log.id)).size).toBe(203)
    expect(result.current.hasMoreLogs).toBe(false)
    expect(result.current.isLoadingMore).toBe(false)

    await act(async () => {
      await result.current.loadMoreLogs()
      await result.current.loadMoreLogs()
      await jest.advanceTimersByTimeAsync(60_000)
    })
    expect(requests).toHaveLength(initialRequestCount + 2)
    expect(result.current.logs).toEqual(chronologicalLogs)
  })
})
