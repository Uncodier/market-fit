import { createClient } from "@/lib/supabase/client"
import { executeImprentaNode } from "@/app/components/agents/imprenta-execution-client"
import { apiClient } from "@/app/services/api-client-service"

const mockGetSession = jest.fn(async () => ({
  data: { session: { access_token: "user-token" } },
}))

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}))

describe("executeImprentaNode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    document.cookie = "market_fit_demo_site_id=; Max-Age=0; path=/"
    ;(createClient as jest.Mock).mockReturnValue({
      auth: { getSession: mockGetSession },
    })
  })

  it("always uses the same-origin contract proxy", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ success: true }),
    } as Response)

    const payload = {
      instance_node_id: "22222222-2222-4222-8222-222222222222",
      message: "Create an image",
    }
    const result = await executeImprentaNode(payload)

    expect(result.success).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/robots/instance/assistant",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: "Bearer user-token",
        }),
      }),
    )
  })

  it("preserves the existing demo interception", async () => {
    document.cookie = "market_fit_demo_site_id=demo-site; path=/"
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      data: { id: "demo-result" },
    })

    const result = await executeImprentaNode({ message: "Create an image" })

    expect(result.success).toBe(true)
    expect(post).toHaveBeenCalledWith(
      "/api/robots/instance/assistant",
      { message: "Create an image" },
    )
    expect(global.fetch).not.toHaveBeenCalled()
    post.mockRestore()
  })
})
