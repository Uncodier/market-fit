import { readSalesPages } from "@/app/api/sales/sales-query"
import { salesTestClient } from "./sales-test-client"

it.each(["insert", "delete"])("does not shift pages when a preceding row is %sed", async change => {
  let rows = [{ id: "b" }, { id: "d" }, { id: "f" }]
  let calls = 0
  const query = () => {
    if (calls++ === 1) rows = change === "insert" ? [{ id: "a" }, ...rows] : rows.filter(row => row.id !== "b")
    return salesTestClient({ sales: rows }, 2).from("sales").select("id")
  }
  expect(await readSalesPages(query)).toEqual([{ id: "b" }, { id: "d" }, { id: "f" }])
})

it("rejects duplicate row IDs instead of double-counting money", async () => {
  const client = salesTestClient({ sales: [{ id: "b" }, { id: "b" }] })
  await expect(readSalesPages(() => client.from("sales").select("id"))).rejects.toThrow("repeated")
})

it("continues after an exactly full page and catches a later query error", async () => {
  let calls = 0
  const query = () => salesTestClient({ sales: [{ id: "b" }] }, 1, calls++ ? "sales" : undefined).from("sales").select("id")
  await expect(readSalesPages(query)).rejects.toThrow("query failed")
})