import React, { StrictMode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { DynamicShortcuts } from "@/app/components/navigation/DynamicShortcuts"
import { loadShortcuts, loadShortcutsFromLocalStorage, saveShortcuts, SHORTCUTS_UPDATED_EVENT } from "@/app/components/navigation/shortcut-storage"
import type { ShortcutRecord } from "@/app/components/navigation/shortcut-types"

let mockUserId = "user-a"
let mockSiteId = "site-a"
let mockLoading = false
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: mockUserId }, isLoading: mockLoading }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: mockLoading }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/context/ScreenAccessContext", () => ({ useOptionalScreenAccess: () => null }))
jest.mock("@/app/components/navigation/use-shortcut-slot-count", () => ({ useShortcutSlotCount: () => 10 }))
jest.mock("@/app/components/navigation/use-sidebar-nav-keys", () => ({ setVisibleSidebarShortcutKeys: jest.fn() }))
jest.mock("@/app/components/navigation/shortcut-storage", () => ({
  loadShortcuts: jest.fn(), loadShortcutsFromLocalStorage: jest.fn(), saveShortcuts: jest.fn(), SHORTCUTS_UPDATED_EVENT: "shortcuts-updated",
}))
jest.mock("@/app/components/navigation/SortableShortcutItem", () => ({
  SortableShortcutItem: ({ id, onPinnedChange, onRemove }: {
    id: string; onPinnedChange: (id: string, pinned: boolean) => void; onRemove: (id: string) => void
  }) => <div><button onClick={() => onPinnedChange(id, true)}>pin {id}</button><button onClick={() => onRemove(id)}>remove {id}</button></div>,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const initial: ShortcutRecord[] = [{ id: "leads", pinned: false }]
const view = () => <StrictMode><DynamicShortcuts isCollapsed={false} /></StrictMode>
function route(path: string, query = "") {
  jest.mocked(usePathname).mockReturnValue(path)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
}
async function flush() { await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  jest.clearAllMocks()
  mockUserId = "user-a"; mockSiteId = "site-a"; mockLoading = false
  route("/robots")
  jest.mocked(loadShortcuts).mockResolvedValue(initial)
  jest.mocked(loadShortcutsFromLocalStorage).mockReturnValue(initial)
  jest.mocked(saveShortcuts).mockResolvedValue(undefined)
})

it("does not save hydration, including prepared defaults, StrictMode and unmount", async () => {
  const load = deferred<ShortcutRecord[]>()
  jest.mocked(loadShortcuts).mockReturnValue(load.promise)
  const { unmount } = render(view())
  expect(saveShortcuts).not.toHaveBeenCalled()
  await act(async () => { load.resolve(initial) })
  expect(screen.getByText("pin reportOverview")).toBeInTheDocument()
  expect(saveShortcuts).not.toHaveBeenCalled()
  unmount()
  expect(saveShortcuts).not.toHaveBeenCalled()
})

it("saves genuine route additions once and skips identical route/local updates while pending and settled", async () => {
  const save = deferred<void>()
  jest.mocked(saveShortcuts).mockReturnValue(save.promise)
  const { rerender } = render(view())
  await flush()
  route("/leads", "page=1"); rerender(view()); await flush()
  expect(saveShortcuts).not.toHaveBeenCalled()
  route("/campaigns"); rerender(view()); await flush()
  expect(saveShortcuts).toHaveBeenCalledTimes(1)
  const submitted = jest.mocked(saveShortcuts).mock.calls[0][2]
  expect(submitted[0]).toEqual({ id: "campaigns", pinned: false })
  jest.mocked(loadShortcutsFromLocalStorage).mockReturnValue(submitted)
  act(() => { window.dispatchEvent(new CustomEvent(SHORTCUTS_UPDATED_EVENT, { detail: { siteId: mockSiteId } })) })
  route("/campaigns", "page=2"); rerender(view()); await flush()
  expect(saveShortcuts).toHaveBeenCalledTimes(1)
  await act(async () => { save.resolve() })
  route("/campaigns", "page=3"); rerender(view()); await flush()
  expect(saveShortcuts).toHaveBeenCalledTimes(1)
})

it("persists pin and removal changes but not identical pin actions", async () => {
  render(view()); await flush()
  fireEvent.click(screen.getByText("pin leads")); await flush()
  fireEvent.click(screen.getByText("pin leads")); await flush()
  expect(saveShortcuts).toHaveBeenCalledTimes(1)
  expect(saveShortcuts).toHaveBeenLastCalledWith("user-a", "site-a", expect.arrayContaining([{ id: "leads", pinned: true }]))
  fireEvent.click(screen.getByText("remove leads")); await flush()
  expect(saveShortcuts).toHaveBeenCalledTimes(2)
})

it("ignores stale loads and foreign events and establishes a fresh user/site baseline", async () => {
  const old = deferred<ShortcutRecord[]>()
  jest.mocked(loadShortcuts).mockReturnValue(old.promise)
  const { rerender } = render(view())
  mockSiteId = "site-b"; mockUserId = "user-b"
  jest.mocked(loadShortcuts).mockResolvedValue([{ id: "campaigns", pinned: false }])
  rerender(view()); await flush()
  await act(async () => { old.resolve(initial) })
  expect(screen.queryByText("pin leads")).not.toBeInTheDocument()
  act(() => { window.dispatchEvent(new CustomEvent(SHORTCUTS_UPDATED_EVENT, { detail: { siteId: "site-a" } })) })
  expect(loadShortcutsFromLocalStorage).not.toHaveBeenCalled()
  expect(saveShortcuts).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText("pin campaigns")); await flush()
  expect(saveShortcuts).toHaveBeenLastCalledWith("user-b", "site-b", expect.any(Array))
})

it("reports a rejected save without treating it as confirmed persistence", async () => {
  const save = deferred<void>()
  jest.mocked(saveShortcuts).mockReturnValue(save.promise)
  const error = new TypeError("Failed to fetch")
  const log = jest.spyOn(console, "error").mockImplementation(() => {})
  try {
    render(view()); await flush()
    fireEvent.click(screen.getByText("pin leads")); await flush()
    await act(async () => { save.reject(error) })
    expect(log).toHaveBeenCalledWith("Failed to save shortcuts", error)
    jest.mocked(saveShortcuts).mockResolvedValue(undefined)
    fireEvent.click(screen.getByText("pin leads")); await flush()
    expect(saveShortcuts).toHaveBeenCalledTimes(2)
  } finally { log.mockRestore() }
})