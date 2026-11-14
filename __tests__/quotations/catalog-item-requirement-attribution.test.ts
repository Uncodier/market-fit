/** @jest-environment node */
import { createClient } from "@/lib/supabase/server"
import { ensureCatalogItemRequirement } from "@/app/quotations/catalog-item-requirements"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const actor = "00000000-0000-4000-8000-000000000001"
function client(authenticated = true, data: unknown = null, error: unknown = null) {
  const rpc = jest.fn(async () => ({ data, error }))
  const from = jest.fn()
  jest.mocked(createClient).mockResolvedValue({ from, rpc,
    auth: { getUser: jest.fn(async () => ({ data: { user: authenticated ? { id: actor } : null }, error: null })) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { rpc, from }
}
const item = "00000000-0000-4000-8000-000000000020"

beforeEach(() => jest.clearAllMocks())

it("rejects malformed item identifiers without database access", async () => {
  expect(await ensureCatalogItemRequirement("not-a-uuid"))
    .toEqual({ error: "Catalog quoting context unavailable" })
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects unauthenticated creation before accessing any records", async () => {
  const { from, rpc } = client(false)
  expect(await ensureCatalogItemRequirement(item)).toEqual({ error: "Authentication required" })
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it("delegates creation and reuse to the atomic RPC without caller attribution", async () => {
  const link = { id: "link", instance_id: "instance", requirement_id: "requirement" }
  const { rpc, from } = client(true, { data: link })
  expect(await ensureCatalogItemRequirement(item)).toEqual({ data: link })
  expect(rpc).toHaveBeenCalledWith("ensure_catalog_item_requirement", { p_catalog_item_id: item })
  expect(from).not.toHaveBeenCalled()
})

it.each([
  [{ error: "Catalog quoting context unavailable" }, null],
  [null, { code: "23505", message: "Private constraint details" }],
  [null, { code: "PGRST202", message: "RPC missing" }],
  [null, null],
  [[], null],
])("fails closed without nontransactional fallback or exposing SQL errors", async (data, error) => {
  const { from, rpc } = client(true, data, error)
  expect(await ensureCatalogItemRequirement(item)).toEqual({ error: "Catalog quoting context unavailable" })
  expect(from).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledTimes(1)
})
