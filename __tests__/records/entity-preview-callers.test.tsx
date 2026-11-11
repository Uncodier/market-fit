import React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { DynamicFieldBadges } from "@/app/records/components/DynamicFieldBadges"
import { resolveRelationsForSidebar, type RecordItem } from "@/app/records/actions"
import { buildGraphData } from "@/app/records/components/records-graph-model"
import { buildPreviewRequests, mergePreviewRequests } from "@/app/records/lib/entity-preview-request"

jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
const site = "11111111-1111-4111-8111-111111111111"
const otherSite = "22222222-2222-4222-8222-222222222222"
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const category = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const field = { id: "relation", name: "Linked", type: "relation", relationTarget: "record", targetCategoryId: category }
const record: RecordItem = {
  category_id: category, title: "Record", description: null, status: "draft", created_at: "2026-01-01", updated_at: "2026-01-01",
  id, site_id: site, relations: { Linked: id }, data: {}, category: { id: category, site_id: site, name: "Category", description: null, icon: null, created_at: "2026-01-01", updated_at: "2026-01-01", template_fields: [field] },
}

beforeEach(() => jest.clearAllMocks())

it("passes record site and category context and ignores stale site responses", async () => {
  let finishFirst!: (value: Record<string, string>) => void
  jest.mocked(resolveRelationsForSidebar)
    .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
    .mockResolvedValueOnce({ [`record:${category}:${id}`]: "Current site record" })
  const { rerender } = render(<DynamicFieldBadges record={record} />)
  await waitFor(() => expect(resolveRelationsForSidebar).toHaveBeenCalledWith([
    { target: "record", ids: [id], targetCategoryId: category },
  ], site))
  rerender(<DynamicFieldBadges record={{ ...record, site_id: otherSite }} />)
  await screen.findByText("Current site record")
  await act(async () => { finishFirst({ [`record:${category}:${id}`]: "Stale site record" }) })
  expect(screen.queryByText("Stale site record")).toBeNull()
  expect(screen.getByText("Current site record")).toBeTruthy()
  expect(resolveRelationsForSidebar).toHaveBeenLastCalledWith(expect.any(Array), otherSite)
})

it("does not issue a context-free request", async () => {
  render(<DynamicFieldBadges record={{ ...record, site_id: "" }} />)
  await act(async () => {})
  expect(resolveRelationsForSidebar).not.toHaveBeenCalled()
})

it("groups requests without losing category boundaries or reinterpreting person", () => {
  const requests = buildPreviewRequests([
    field,
    { ...field, name: "Other", targetCategoryId: id },
    { ...field, name: "Person", relationTarget: "person", targetCategoryId: undefined },
  ], { Linked: id, Other: id, Person: id })
  expect(mergePreviewRequests([...requests, ...requests])).toEqual(requests)
  expect(requests[2].target).toBe("person")
})

it("keeps record and external nodes distinct when UUIDs collide", () => {
  const fields = [
    { name: "Lead", type: "relation", relationTarget: "lead" },
    { name: "Company", type: "relation", relationTarget: "company" },
  ]
  const graph = buildGraphData([
    { id, title: "Origin", category: { template_fields: fields }, relations: { Lead: id, Company: id } },
  ], [], { [`lead:${id}`]: "Lead label", [`company:${id}`]: "Company label" })
  expect(graph.nodes.map(node => node.id)).toEqual([id, `lead:${id}`, `company:${id}`])
  expect(graph.nodes.map(node => node.label)).toEqual(["Origin", "Lead label", "Company label"])
  expect(graph.links.map(link => link.target)).toEqual([`lead:${id}`, `company:${id}`])
})