import { deleteDeal } from "@/app/deals/actions"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/companies/actions", () => ({ findOrCreateCompany: jest.fn() }))

const id = "a2fb44cc-bf79-4994-a0a5-bc517f990bc1"
const mockSelect = jest.fn()
const mockEq = jest.fn(() => ({ select: mockSelect }))
const mockDelete = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ delete: mockDelete }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createClient>)
  mockSelect.mockResolvedValue({ data: [{ id }], error: null })
})

it("uses the user-scoped client and verifies the deleted row identity", async () => {
  expect(await deleteDeal(id)).toEqual({ error: null })
  expect(mockFrom).toHaveBeenCalledWith("deals")
  expect(mockDelete).toHaveBeenCalledTimes(1)
  expect(mockEq).toHaveBeenCalledWith("id", id)
  expect(mockSelect).toHaveBeenCalledWith("id")
})

it.each(["", "invalid", "id' OR true"])("rejects malformed ID %j before querying", async value => {
  expect(await deleteDeal(value)).toEqual({ error: "Invalid deal ID" })
  expect(createClient).not.toHaveBeenCalled()
})

it.each([null, [], [{ id: "another-deal" }]])("does not report success for an invisible, denied, or mismatched row %j", async data => {
  mockSelect.mockResolvedValueOnce({ data, error: null })
  expect((await deleteDeal(id)).error).toBeTruthy()
})

it("returns a safe failure for authentication or database errors", async () => {
  mockSelect.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Private database details" } })
  expect(await deleteDeal(id)).toEqual({ error: "Failed to delete deal" })
})

it("returns a safe failure for network exceptions", async () => {
  mockSelect.mockRejectedValueOnce(new Error("Network failed"))
  expect(await deleteDeal(id)).toEqual({ error: "Failed to delete deal" })
})