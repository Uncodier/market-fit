import { updateRequirement } from "@/app/requirements/actions"
import { createClient } from "@/lib/supabase/server"

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}))
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}))
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

describe("updateRequirement", () => {
  it("does not rewrite unchanged segment and campaign relations", async () => {
    const requirementUpdate = jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: "requirement-1", title: "Edited" },
            error: null,
          }),
        })),
      })),
    }))
    const segmentDelete = jest.fn()
    const segmentInsert = jest.fn()
    const campaignDelete = jest.fn()
    const campaignInsert = jest.fn()

    ;(createClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "requirements") return { update: requirementUpdate }
        if (table === "requirement_segments") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [{ segment_id: "segment-1" }],
                error: null,
              }),
            })),
            delete: segmentDelete,
            insert: segmentInsert,
          }
        }
        if (table === "campaign_requirements") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            })),
            delete: campaignDelete,
            insert: campaignInsert,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const result = await updateRequirement({
      id: "requirement-1",
      title: "Edited",
      description: "Description",
      type: "task",
      priority: "medium",
      status: "backlog",
      completionStatus: "pending",
      source: "",
      budget: null,
      segments: ["segment-1"],
      campaigns: [],
      campaign_id: "",
    })

    expect(result).toEqual({
      data: { id: "requirement-1", title: "Edited" },
    })
    expect(segmentDelete).not.toHaveBeenCalled()
    expect(segmentInsert).not.toHaveBeenCalled()
    expect(campaignDelete).not.toHaveBeenCalled()
    expect(campaignInsert).not.toHaveBeenCalled()
  })
})
