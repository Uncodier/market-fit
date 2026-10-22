import { act, renderHook, waitFor } from "@testing-library/react"
import { getSelfServiceModifierOptions } from "@/app/commerce/self-service-modifier-options-actions"
import { useSelfServiceModifiers } from "@/app/shop/[siteSlug]/self-service/useSelfServiceModifiers"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"

jest.mock("@/app/commerce/self-service-modifier-options-actions", () => ({ getSelfServiceModifierOptions: jest.fn() }))
const parent = [{ id: "parent-group" }] as ModifierGroupWithItems[]
const child = [{ id: "child-group" }] as ModifierGroupWithItems[]
const modifier = { groupId: "child-group", catalogItemId: "extra", name: "Extra", cartPrice: 2, cartQty: 1 }
const request = { locationId: "branch", hostId: "parent", fulfillment: "pickup" }
beforeEach(() => { jest.clearAllMocks() })

it("blocks until variant-specific groups load and resets selection across variants", async () => {
  jest.mocked(getSelfServiceModifierOptions).mockResolvedValue({ data: child })
  const { result, rerender } = renderHook(({ id }) => useSelfServiceModifiers({ ...request, selectedId: id }, { data: parent }, "pickup"), { initialProps: { id: "parent" } })
  expect(result.current.groups).toEqual(parent)
  rerender({ id: "child" })
  expect(result.current.ready).toBe(false)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(getSelfServiceModifierOptions).toHaveBeenCalledWith({ ...request, selectedId: "child" })
  expect(result.current.groups).toEqual(child)
  act(() => result.current.setModifiers([modifier]))
  jest.mocked(getSelfServiceModifierOptions).mockResolvedValue({ data: parent })
  rerender({ id: "other-child" })
  expect(result.current.modifiers).toEqual([])
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.groups).toEqual(parent)
})

it("fails closed if loading child-specific required options fails", async () => {
  jest.mocked(getSelfServiceModifierOptions).mockResolvedValue({ data: [], error: "Unavailable" })
  const { result } = renderHook(() => useSelfServiceModifiers({ ...request, selectedId: "child" }, { data: parent }, "pickup"))
  await waitFor(() => expect(result.current.error).toBe("Unavailable"))
  expect(result.current.groups).toEqual([])
})

it("clears selections immediately and rechecks scoped options/prices when fulfillment changes", async () => {
  jest.mocked(getSelfServiceModifierOptions).mockResolvedValue({ data: child })
  const { result, rerender } = renderHook(({ fulfillment }) => useSelfServiceModifiers({ ...request, fulfillment }, { data: parent }, "pickup"), { initialProps: { fulfillment: "pickup" } })
  act(() => result.current.setModifiers([modifier]))
  rerender({ fulfillment: "dine_in" })
  expect(result.current.ready).toBe(false)
  expect(result.current.modifiers).toEqual([])
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(getSelfServiceModifierOptions).toHaveBeenCalledWith({ ...request, selectedId: "parent", fulfillment: "dine_in" })
  expect(result.current.groups).toEqual(child)
  rerender({ fulfillment: "pickup" })
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.modifiers).toEqual([])
  expect(getSelfServiceModifierOptions).toHaveBeenCalledTimes(2)
})

it("ignores stale responses after variant or fulfillment changes", async () => {
  let finish!: (result: { data: ModifierGroupWithItems[] }) => void
  jest.mocked(getSelfServiceModifierOptions).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    .mockResolvedValueOnce({ data: child })
  const { result, rerender } = renderHook(({ fulfillment }) => useSelfServiceModifiers({ ...request, selectedId: "child", fulfillment }, { data: parent }, "pickup"), { initialProps: { fulfillment: "pickup" } })
  rerender({ fulfillment: "dine_in" })
  await waitFor(() => expect(result.current.groups).toEqual(child))
  await act(async () => finish({ data: parent }))
  expect(result.current.groups).toEqual(child)
})