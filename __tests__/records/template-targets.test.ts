import { validateTemplateTargets } from "@/app/records/lib/validate-template-targets"

it("requires all related categories in the source site", async () => {
  const eq = jest.fn()
  const query = { select: jest.fn(), eq, in: jest.fn().mockResolvedValue({ data: [], error: null }) }
  query.select.mockReturnValue(query)
  eq.mockReturnValue(query)
  const client = { from: jest.fn(() => query) }
  await expect(validateTemplateTargets(client as never, "site", [
    { id: "relation", name: "relation", type: "relation", targetCategoryId: "foreign" },
  ])).rejects.toThrow(/in this site/)
  expect(eq).toHaveBeenCalledWith("site_id", "site")
})

it("does not query categories when no category-specific links are configured", async () => {
  const from = jest.fn()
  await expect(validateTemplateTargets({ from } as never, "site", [])).resolves.toBeUndefined()
  expect(from).not.toHaveBeenCalled()
})