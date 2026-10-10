import { act, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { useOnboardingValidation } from "@/app/components/dashboard/hooks/use-onboarding-validation"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import type { SiteContextType } from "@/app/context/site-types"
import { capabilitiesFromRole, resetPermissionStore, setPermissionStore } from "@/lib/permissions/capabilities"
import { wrapSupabaseClient } from "@/lib/permissions/mutation-guard"
import { ALL_TASK_IDS } from "@/app/lib/onboarding-task-ids"
import { resetPermissionNotify } from "@/lib/permissions/notify"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

type Settings = {
  site_id: string
  onboarding: Record<string, boolean>
  social_media?: unknown[]
  channels?: Record<string, unknown>
}

function setup(initial: Settings | null = {
  site_id: "site-1",
  onboarding: { take_guided_tour: true },
  social_media: [{ id: "social", _license: { order: 1 }, license_suspended: false }],
  channels: { connections: [{ id: "agent", _license: { order: 2 }, status: "connected" }] },
}) {
  let row = initial
  let readError: { code: string; message: string } | null = null
  let writeError: { code: string; message: string } | null = null
  let workflows = false
  const writes = jest.fn()
  const reads = jest.fn()
  const from = (table: string) => {
    let payload: Partial<Settings> | null = null
    let operation = "select"
    let siteId: string | null = null
    const execute = async () => {
      if (table !== "settings") return { data: workflows && table === "workflows" ? [{ id: "workflow" }] : [], error: null }
      if (!payload) {
        reads(siteId)
        return { data: row, error: readError }
      }
      writes(operation, payload, siteId)
      if (writeError) return { data: null, error: writeError }
      if (operation === "upsert" && payload.social_media) {
        return { data: null, error: { code: "42501", message: "Resource license metadata is server managed" } }
      }
      row = { ...row, ...payload } as Settings
      return { data: row, error: null }
    }
    const builder = {
      select: jest.fn().mockImplementation(() => builder),
      eq: jest.fn().mockImplementation((_key: string, value: string) => { siteId = value; return builder }),
      limit: jest.fn().mockImplementation(() => builder),
      single: execute,
      maybeSingle: execute,
      update: (value: Partial<Settings>) => { operation = "update"; payload = value; return builder },
      insert: (value: Partial<Settings>) => { operation = "insert"; payload = value; return builder },
      upsert: (value: Partial<Settings>) => { operation = "upsert"; payload = value; return builder },
      then: (resolve: (value: Awaited<ReturnType<typeof execute>>) => unknown) => execute().then(resolve),
    }
    return builder
  }
  const onDenied = jest.fn()
  jest.mocked(createClient).mockReturnValue(wrapSupabaseClient({ from }, { onDenied }) as ReturnType<typeof createClient>)
  return {
    writes, reads, onDenied, row: () => row,
    failRead: () => { readError = { code: "503", message: "Unavailable" } },
    failWrite: () => { writeError = { code: "503", message: "Unavailable" } },
    addWorkflow: () => { workflows = true },
  }
}

describe("onboarding progress persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    resetPermissionNotify()
    jest.mocked(useSite).mockReturnValue({ currentSite: { id: "site-1", settings: {} } } as SiteContextType)
    setPermissionStore({ siteId: "site-1", capabilities: capabilitiesFromRole("owner"), loaded: true })
  })
  afterEach(() => {
    jest.useRealTimers()
    resetPermissionStore()
  })

  async function mount() {
    const hook = renderHook(() => useOnboardingValidation())
    await act(async () => {})
    return hook
  }

  it("lets an owner complete and reopen a task without resubmitting licensed settings", async () => {
    const db = setup()
    const resources = { social_media: db.row()?.social_media, channels: db.row()?.channels }
    const { result } = await mount()
    await act(async () => result.current.toggleTask("create_workflows", true))
    expect(db.writes).toHaveBeenLastCalledWith("update", {
      onboarding: { take_guided_tour: true, create_workflows: true },
    }, "site-1")
    expect(result.current.tasks.create_workflows).toBe(true)
    await act(async () => result.current.toggleTask("create_workflows", false))
    expect(result.current.tasks.create_workflows).toBe(false)
    expect(db.row()).toMatchObject(resources)
    expect(db.onDenied).not.toHaveBeenCalled()
  })

  it("marks only the requested tasks done and preserves previous progress", async () => {
    const db = setup()
    const { result } = await mount()
    await act(async () => result.current.markAllDone(["create_workflows", "configure_channels"]))
    expect(db.writes).toHaveBeenLastCalledWith("update", {
      onboarding: { take_guided_tour: true, create_workflows: true, configure_channels: true },
    }, "site-1")
    expect(result.current.tasks.configure_channels).toBe(true)
  })

  it("initializes missing settings with only site ID and onboarding", async () => {
    const db = setup(null)
    const { result } = await mount()
    await act(async () => result.current.toggleTask("create_workflows", true))
    expect(db.writes).toHaveBeenLastCalledWith("insert", {
      site_id: "site-1", onboarding: { create_workflows: true },
    }, null)
    expect(result.current.tasks.create_workflows).toBe(true)
  })

  it("does not attempt a write after a failed settings read", async () => {
    const db = setup()
    const { result } = await mount()
    db.failRead()
    await act(async () => result.current.toggleTask("create_workflows", true))
    expect(db.writes).not.toHaveBeenCalled()
    expect(result.current.tasks.create_workflows).toBeUndefined()
    expect(toast.error).toHaveBeenCalled()
  })

  it("reports failed writes without reloading or claiming completion", async () => {
    const db = setup()
    const { result } = await mount()
    db.reads.mockClear()
    db.failWrite()
    await act(async () => result.current.toggleTask("create_workflows", true))
    expect(db.reads).toHaveBeenCalledTimes(1)
    expect(result.current.tasks.create_workflows).toBeUndefined()
    expect(toast.error).toHaveBeenCalled()
  })

  it("preserves the write guard for read-only members", async () => {
    const db = setup()
    setPermissionStore({ siteId: "site-1", capabilities: capabilitiesFromRole("marketing"), loaded: true })
    const { result } = await mount()
    await act(async () => result.current.toggleTask("create_workflows", true))
    expect(db.writes).not.toHaveBeenCalled()
    expect(db.onDenied).toHaveBeenCalled()
    expect(result.current.tasks.create_workflows).toBeUndefined()
  })

  it("auto-validates new progress using an onboarding-only update", async () => {
    const db = setup()
    db.addWorkflow()
    const { result } = await mount()
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    expect(db.writes).toHaveBeenCalledWith("update", {
      onboarding: { take_guided_tour: true, create_workflows: true },
    }, "site-1")
    expect(result.current.tasks.create_workflows).toBe(true)
  })

  it("does not write during auto-validation if no new task was completed", async () => {
    const db = setup()
    await mount()
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    expect(db.writes).not.toHaveBeenCalled()
  })

  it("leaves auto-validation idle when its initial read fails", async () => {
    const db = setup()
    const { result } = await mount()
    db.failRead()
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    expect(db.writes).not.toHaveBeenCalled()
    expect(result.current.isValidating).toBe(false)
  })

  it("clears the completed cache when a previously finished task is reopened", async () => {
    setup({ site_id: "site-1", onboarding: Object.fromEntries(ALL_TASK_IDS.map(id => [id, true])) })
    const { result } = await mount()
    expect(localStorage.getItem("onboarding_completed_site-1")).toBe("true")
    await act(async () => result.current.toggleTask("create_workflows", false))
    expect(localStorage.getItem("onboarding_completed_site-1")).toBeNull()
  })

  it("does not persist demo task changes", async () => {
    const db = setup()
    jest.mocked(useSite).mockReturnValue({ currentSite: { id: "demo-site" } } as SiteContextType)
    const { result } = await mount()
    await act(async () => result.current.toggleTask("create_workflows", false))
    await act(async () => result.current.markAllDone(["create_workflows"]))
    expect(db.reads).not.toHaveBeenCalled()
    expect(db.writes).not.toHaveBeenCalled()
  })
})