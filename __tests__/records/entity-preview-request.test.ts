import { buildPreviewRequests, entityPreviewKey, fetchPreviewBatches, fieldPreviewKey, mergePreviewRequests, type EntityPreviewRequest } from "@/app/records/lib/entity-preview-request"

it("ignores empty historical relations without dropping populated siblings", () => {
  const fields = ["empty", "spaces", "null", "valid", "missing"].map(name => ({
    name, type: "relation", ...(name !== "missing" ? { relationTarget: "record" } : {}),
  }))
  expect(buildPreviewRequests(fields, { empty: "", spaces: "  ", null: null, valid: "id", missing: "other" }))
    .toEqual([{ target: "record", ids: ["id"] }, { target: "lead", ids: ["other"] }])
  expect(fieldPreviewKey(fields[4], "other")).toBe("lead:other")
  expect(mergePreviewRequests([{ target: "lead", ids: ["", " "] }, { target: "record", ids: ["id", ""] }]))
    .toEqual([{ target: "record", ids: ["id"] }])
})

it("bounds many category requests and removes raw aliases ambiguous across batches", async () => {
  const requests = Array.from({ length: 51 }, (_, index) => ({
    target: "record", targetCategoryId: `category-${index}`, ids: ["same-id"],
  }))
  const resolve = jest.fn(async (batch: EntityPreviewRequest[]) => Object.fromEntries(batch.flatMap(request => [
    [entityPreviewKey(request, "same-id"), request.targetCategoryId], ["same-id", request.targetCategoryId],
  ])))
  const result = await fetchPreviewBatches(requests, "site", resolve)
  expect(resolve.mock.calls.map(([batch]) => batch.length)).toEqual([50, 1])
  expect(Object.keys(result)).toHaveLength(51)
  expect(result["same-id"]).toBeUndefined()
  expect(result["record:category-50:same-id"]).toBe("category-50")
})

it("does not call the resolver for empty historical batches", async () => {
  const resolve = jest.fn()
  expect(await fetchPreviewBatches([{ target: "lead", ids: [""] }], "site", resolve)).toEqual({})
  expect(resolve).not.toHaveBeenCalled()
})