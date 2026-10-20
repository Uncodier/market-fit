import { act, renderHook } from "@testing-library/react"
import { useSearchPagination } from "@/lib/catalog-search/use-search-pagination"

it("retains restored page/snapshot until the initial site loads, then resets for a real tenant switch", () => {
  const id = "11111111-1111-4111-8111-111111111111"
  window.history.replaceState(null, "", `/catalog?q=shoes&page=2&search_id=${id}`)
  const { result, rerender } = renderHook(({ scope, ready }) => useSearchPagination(scope, true, ready), {
    initialProps: { scope: "no-site-yet", ready: false },
  })
  expect(result.current.page).toBe(2)
  expect(new URLSearchParams(window.location.search).get("search_id")).toBe(id)
  rerender({ scope: "site-one", ready: true })
  expect(result.current.page).toBe(2)
  expect(result.current.searchId).toBe(id)
  act(() => result.current.setPage(3))
  expect(new URLSearchParams(window.location.search).get("page")).toBe("3")
  rerender({ scope: "site-two", ready: true })
  expect(result.current.page).toBe(1)
  expect(result.current.searchId).toBeUndefined()
  expect(new URLSearchParams(window.location.search).has("search_id")).toBe(false)
})