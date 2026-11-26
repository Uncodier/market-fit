import { fireEvent, render, screen } from "@testing-library/react"
import { WorkspaceDetailNavigation } from "@/app/components/navigation/WorkspaceDetailNavigation"
import { useDetailViewLeaveGuard } from "@/app/hooks/use-detail-view-leave-guard"
import { DETAIL_VIEW_LEAVE_EVENT, getDetailViewNeighbors, openDetailFromView } from "@/lib/navigation/detail-view-navigation"

let mockKey = ""
let mockSiteId = "site-a"
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ detailView: mockKey }) }))
jest.mock("@/app/context/SiteContext", () => ({
  useOptionalSite: () => ({ currentSite: { id: mockSiteId }, isLoading: false }),
}))

function keyFrom(href: string) {
  return new URL(href, "https://workspace.invalid").searchParams.get("detailView") || ""
}

beforeEach(() => {
  sessionStorage.clear()
  mockKey = ""
  mockSiteId = "site-a"
})

it("preserves the entry URL and only follows ordered siblings from the same workspace collection", () => {
  const href = openDetailFromView("site-a", "/orders/second?title=Order+2#lines", [
    "/orders/third", "/sales/other", "/orders/second", "/orders/first", "/orders/first",
  ])
  const key = keyFrom(href)
  expect(key).toBeTruthy()
  expect(href).toBe(`/orders/second?title=Order+2&detailView=${key}#lines`)
  expect(getDetailViewNeighbors("site-a", "/orders/second", key)).toEqual({
    previous: `/orders/third?detailView=${key}`, next: `/orders/first?detailView=${key}`,
  })
  expect(getDetailViewNeighbors("site-b", "/orders/second", key)).toBeNull()
  expect(getDetailViewNeighbors("site-a", "/orders/missing", key)).toBeNull()
  expect(getDetailViewNeighbors("site-a", "/orders/second", "")).toBeNull()
})

it.each(["/robots/abc", "/purchases/tenders/new", "/purchases/tenders/abc/edit", "/buyer/orders/abc"])(
  "does not create navigation context for %s", path => {
    expect(openDetailFromView("site-a", path, [path, `${path}-other`])).toBe(path)
  },
)

it("shows shared desktop controls with tooltips only when the detail has list context", async () => {
  const path = "/purchases/requests/first"
  const view = render(<WorkspaceDetailNavigation pathname={path} />)
  expect(screen.queryByRole("group", { name: "Record navigation" })).not.toBeInTheDocument()
  mockKey = keyFrom(openDetailFromView("site-a", path, [path, "/purchases/requests/next"]))
  view.rerender(<WorkspaceDetailNavigation pathname={path} />)
  const link = screen.getByRole("link", { name: "Next record" })
  expect(link).toHaveAttribute("href", `/purchases/requests/next?detailView=${mockKey}`)
  expect(screen.getByRole("button", { name: "Previous record" })).toBeDisabled()
  fireEvent.focus(link)
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Next record")
  mockSiteId = "site-b"
  view.rerender(<WorkspaceDetailNavigation pathname={path} />)
  expect(screen.queryByRole("group", { name: "Record navigation" })).not.toBeInTheDocument()
})

it("blocks sibling navigation during a save or when the user keeps unsaved edits", () => {
  function Guard({ busy }: { busy: boolean }) {
    useDetailViewLeaveGuard({ busy, dirty: true })
    return null
  }
  const leave = () => window.dispatchEvent(new Event(DETAIL_VIEW_LEAVE_EVENT, { cancelable: true }))
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false)
  try {
    const view = render(<Guard busy />)
    expect(leave()).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    view.rerender(<Guard busy={false} />)
    expect(leave()).toBe(false)
    confirm.mockReturnValue(true)
    expect(leave()).toBe(true)
  } finally {
    confirm.mockRestore()
  }
})