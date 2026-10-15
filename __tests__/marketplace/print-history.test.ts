import { markKitchenItemsPrinted } from "@/app/printer/actions"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "node:crypto"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

describe("kitchen print history failures", () => {
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(), update: jest.fn() }
  beforeEach(() => {
    jest.clearAllMocks()
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.maybeSingle.mockResolvedValue({ data: { id: "line", metadata: { marketplace: { external_id: "external" } } }, error: null })
    query.update.mockReturnValue(query)
    jest.mocked(createClient).mockResolvedValue({ from: () => query } as never)
  })
  it("reports a missing or unreadable item instead of reporting success", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await markKitchenItemsPrinted("site", [{ id: "line", quantity: 0 }])).toEqual({ error: "Printed item could not be loaded" })
    expect(query.update).not.toHaveBeenCalled()
  })
  it("reports rejected acknowledgements without disclosing database error details", async () => {
    query.update.mockReturnValue({ eq: () => ({ eq: async () => ({ error: { message: "database detail" } }) }) })
    expect(await markKitchenItemsPrinted("site", [{ id: "line", quantity: 0 }])).toEqual({ error: "Print history could not be saved" })
  })
  it("preserves provider metadata while acknowledging a cancellation", async () => {
    query.update.mockReturnValue({ eq: () => ({ eq: async () => ({ error: null }) }) })
    expect(await markKitchenItemsPrinted("site", [{ id: "line", quantity: 0 }])).toEqual({})
    expect(query.update).toHaveBeenCalledWith({ metadata: { marketplace: { external_id: "external" }, printed_quantity: 0 } })
  })
  it("does not expose sensitive values from thrown client errors", async () => {
    const sensitive = randomBytes(24).toString("hex")
    jest.mocked(createClient).mockRejectedValueOnce(new Error(`Connection failed: ${sensitive}`))
    const result = await markKitchenItemsPrinted("site", [{ id: "line", quantity: 0 }])
    expect(result).toEqual({ error: "Print history could not be saved" })
    expect(JSON.stringify(result)).not.toContain(sensitive)
  })
})