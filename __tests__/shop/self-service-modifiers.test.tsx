import { act, renderHook, waitFor } from "@testing-library/react"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import { useSelfServiceModifiers } from "@/app/shop/[siteSlug]/self-service/useSelfServiceModifiers"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"

jest.mock("@/app/catalog/modifier-actions", () => ({ getModifierGroupsForCatalogItem: jest.fn() }))
const parent = [{ id: "parent-group" }] as ModifierGroupWithItems[]
const child = [{ id: "child-group" }] as ModifierGroupWithItems[]
const modifier = { groupId: "child-group", catalogItemId: "extra", name: "Extra", cartPrice: 2, cartQty: 1 }
beforeEach(() => { jest.clearAllMocks() })

it("blocks until variant-specific groups load and resets selection across variants", async () => {
  jest.mocked(getModifierGroupsForCatalogItem).mockResolvedValue({ data: child })
  const { result, rerender } = renderHook(({ id }) => useSelfServiceModifiers("parent", id, parent, false), { initialProps: { id: "parent" } })
  expect(result.current.groups).toEqual(parent)
  rerender({ id: "child" })
  expect(result.current.ready).toBe(false)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(getModifierGroupsForCatalogItem).toHaveBeenCalledWith("child")
  expect(result.current.groups).toEqual(child)
  act(() => result.current.setModifiers([modifier]))
  jest.mocked(getModifierGroupsForCatalogItem).mockResolvedValue({ data: parent })
  rerender({ id: "other-child" })
  expect(result.current.modifiers).toEqual([])
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.groups).toEqual(parent)
})

it("fails closed if loading child-specific required options fails", async () => {
  jest.mocked(getModifierGroupsForCatalogItem).mockResolvedValue({ data: [], error: "Unavailable" })
  const { result } = renderHook(() => useSelfServiceModifiers("parent", "child", parent, false))
  await waitFor(() => expect(result.current.error).toBe(true))
  expect(result.current.groups).toEqual([])
})