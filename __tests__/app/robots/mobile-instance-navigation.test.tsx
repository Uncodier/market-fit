import { act, renderHook } from "@testing-library/react"
import { useMobileInstanceNavigation } from "@/app/robots/use-mobile-instance-navigation"
import { mobileInstanceListHref, mobileInstanceDetailHref, isInstanceListView } from "@/app/robots/mobile-instance-navigation"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
type Workspace = Parameters<typeof useMobileInstanceNavigation>[0]
const router = { replace: jest.fn() }
const setLocalSelectedInstanceId = jest.fn()
function input(search = "", extra = {}): Workspace {
  return {
    isMobile: true, searchParams: new URLSearchParams(search), selectedInstanceId: "one",
    activeRobotInstance: { id: "one", name: "First" }, router, setLocalSelectedInstanceId,
    getInstanceById: (id: string) => ({ id, name: "Selected" }), ...extra,
  } as unknown as Workspace
}
beforeEach(() => jest.clearAllMocks())

test("preserves automatic selection and canonicalizes it for navigation visibility", () => {
  const view = renderHook(useMobileInstanceNavigation, { initialProps: input() })
  expect(view.result.current.showList).toBe(false)
  expect(router.replace).toHaveBeenCalledWith("/robots?instance=one", { scroll: false })
})

test("pushes the list and detail screens, with browser back/forward restoring the list", () => {
  const view = renderHook(useMobileInstanceNavigation, { initialProps: input("instance=one&mode=workflow&screen=files") })
  act(() => view.result.current.backToInstances())
  expect(navigateOrAssign).toHaveBeenLastCalledWith(router, "/robots?mode=workflow&view=instances")
  expect(setLocalSelectedInstanceId).toHaveBeenLastCalledWith("one")
  view.rerender(input("mode=workflow&view=instances"))
  expect(view.result.current.showList).toBe(true)
  expect(router.replace).not.toHaveBeenCalled()
  act(() => view.result.current.selectInstance("two"))
  expect(navigateOrAssign).toHaveBeenLastCalledWith(router, "/robots?mode=workflow&instance=two&name=Selected")
  view.rerender(input("mode=workflow&instance=two", { selectedInstanceId: "two" }))
  expect(view.result.current.showList).toBe(false)
  view.rerender(input("mode=workflow&view=instances"))
  expect(view.result.current.showList).toBe(true)
})

test.each([{ isMobile: false }, { searchParams: new URLSearchParams("artifact=true&view=instances") }])(
  "leaves desktop and embedded workspaces unchanged", (extra) => {
    const view = renderHook(useMobileInstanceNavigation, { initialProps: input("view=instances", extra) })
    expect(view.result.current.isMobileWorkspace).toBe(false)
    expect(view.result.current.showList).toBe(false)
    expect(router.replace).not.toHaveBeenCalled()
  },
)

test("list URLs remove instance-specific and auto-run inputs", () => {
  expect(mobileInstanceListHref("instance=one&instanceId=one&name=A&query=run&activity=robot&new=true&screen=files&tab=preview"))
    .toBe("/robots?view=instances")
  expect(mobileInstanceDetailHref("view=instances&mode=imprenta&instance_id=old", "two"))
    .toBe("/robots?mode=imprenta&instance=two")
  expect(isInstanceListView(new URLSearchParams("view=instances"))).toBe(true)
})