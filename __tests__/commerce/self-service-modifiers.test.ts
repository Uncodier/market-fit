/** @jest-environment node */
jest.mock("server-only", () => ({}))
import { assertSelfServiceModifiers } from "@/app/commerce/self-service-modifiers"

const host = "host"
const parent = "parent"
const group = { id: "group", site_id: "site", name: "Size", min_select: 1, max_select: 1 }
function setup(own = host, min = 1) {
  const from = jest.fn((table: string) => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ error: null, data: table === "catalog_item_modifier_groups"
      ? [{ catalog_item_id: own, modifier_group: { ...group, min_select: min } }]
      : [{ modifier_group_id: group.id, catalog_item_id: "small" }] }),
  }))
  return { from }
}

it("rejects bypassing required selections and unknown modifier groups/items", async () => {
  const client = setup()
  await expect(assertSelfServiceModifiers(client, "site", [{ catalogItemId: host, quantity: 1 }], [{ id: host }])).rejects.toThrow("Select at least")
  await expect(assertSelfServiceModifiers(client, "site", [{ catalogItemId: host, quantity: 1,
    modifiers: [{ catalogItemId: "small", quantity: 1, groupId: "forged" }] }], [{ id: host }])).rejects.toThrow("Unknown modifier group")
  await expect(assertSelfServiceModifiers(client, "site", [{ catalogItemId: host, quantity: 1,
    modifiers: [{ catalogItemId: "forged", quantity: 1, groupId: "group" }] }], [{ id: host }])).rejects.toThrow("does not belong")
})

it("uses parent groups for variants and enforces maximum units", async () => {
  const client = setup(parent)
  const line = { catalogItemId: host, quantity: 1, modifiers: [{ catalogItemId: "small", groupId: "group", quantity: 1 }] }
  await expect(assertSelfServiceModifiers(client, "site", [line], [{ id: host, parent_id: parent }])).resolves.toBeUndefined()
  await expect(assertSelfServiceModifiers(client, "site", [{ ...line, modifiers: [{ ...line.modifiers[0], quantity: 2 }] }], [{ id: host, parent_id: parent }])).rejects.toThrow("Select at most")
})