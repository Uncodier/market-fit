const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockMaybeSingle = jest.fn()
const mockUpsert = jest.fn()
const mockFrom = jest.fn()

const mockQuery = {
  select: mockSelect,
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
  upsert: mockUpsert,
}

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}))

import {
  getShortcutStorageKey,
  loadShortcuts,
  loadShortcutsFromLocalStorage,
  saveShortcuts,
  saveShortcutsToLocalStorage,
} from "@/app/components/navigation/shortcut-storage"

describe("site-scoped shortcut storage", () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    mockFrom.mockReturnValue(mockQuery)
    mockSelect.mockReturnValue(mockQuery)
    mockEq.mockReturnValue(mockQuery)
  })

  it("keeps local shortcuts isolated by site", () => {
    saveShortcutsToLocalStorage("site-a", [
      { id: "orders", pinned: true },
    ])
    saveShortcutsToLocalStorage("site-b", [
      { id: "people", pinned: false },
    ])

    expect(loadShortcutsFromLocalStorage("site-a")).toEqual([
      { id: "orders", pinned: true },
    ])
    expect(loadShortcutsFromLocalStorage("site-b")).toEqual([
      { id: "people", pinned: false },
    ])
  })

  it("migrates legacy local shortcuts into the active site once", () => {
    localStorage.setItem(
      "navigationShortcuts_v3",
      JSON.stringify([{ id: "orders", pinned: true }]),
    )

    expect(loadShortcutsFromLocalStorage("site-a")).toEqual([
      { id: "orders", pinned: true },
    ])
    expect(localStorage.getItem("navigationShortcuts_v3")).toBeNull()
    expect(localStorage.getItem(getShortcutStorageKey("site-a"))).not.toBeNull()
    expect(loadShortcutsFromLocalStorage("site-b")).toEqual([])
  })

  it("loads the current user's shortcuts for the active site", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { shortcuts: [{ id: "orders", pinned: true }] },
      error: null,
    })

    await expect(loadShortcuts("user-1", "site-a")).resolves.toEqual([
      { id: "orders", pinned: true },
    ])

    expect(mockFrom).toHaveBeenCalledWith("user_shortcuts")
    expect(mockSelect).toHaveBeenCalledWith("shortcuts")
    expect(mockEq).toHaveBeenNthCalledWith(1, "user_id", "user-1")
    expect(mockEq).toHaveBeenNthCalledWith(2, "site_id", "site-a")
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
  })

  it("upserts shortcuts by user and site", async () => {
    mockUpsert.mockResolvedValue({ error: null })
    const shortcuts = [{ id: "orders", pinned: true }]

    await saveShortcuts("user-1", "site-a", shortcuts)

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        site_id: "site-a",
        shortcuts,
        updated_at: expect.any(String),
      },
      { onConflict: "user_id,site_id" },
    )
  })
})
