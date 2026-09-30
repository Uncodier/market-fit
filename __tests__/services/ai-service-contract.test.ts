/** @jest-environment node */

import { buildSegmentsWithAI, buildContentWithAI } from "@/app/services/ai-service"
import { aiRequestState } from "@/app/services/ai-request-state"
import { createClient } from "@/lib/supabase/client"
import { apiClient } from "@/app/services/api-client-service"
import { isDemoModeActive } from "@/lib/demo-utils"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/services/api-client-service", () => ({
  apiClient: { post: jest.fn(), getApiUrl: () => "https://api.example.test" },
}))
jest.mock("@/lib/demo-utils", () => ({ isDemoModeActive: jest.fn() }))

describe("AI service extraction", () => {
  const getSession = jest.fn()
  const params = { site_id: "site-1", user_id: "user-1" }

  beforeEach(() => {
    jest.resetAllMocks()
    aiRequestState.inProgress = false
    jest.mocked(createClient).mockReturnValue({ auth: { getSession } })
    getSession.mockResolvedValue({ data: { session: { user: { id: params.user_id } } } })
    jest.mocked(isDemoModeActive).mockReturnValue(false)
  })

  it("shares the in-flight guard across builder modules", async () => {
    let release!: (value: Awaited<ReturnType<typeof apiClient.post>>) => void
    jest.mocked(apiClient.post).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))

    const first = buildSegmentsWithAI(params)
    await Promise.resolve()
    expect(aiRequestState.inProgress).toBe(true)
    expect((await buildContentWithAI(params)).error).toContain("already in progress")
    expect(apiClient.post).toHaveBeenCalledTimes(1)

    release({ success: true, data: { job_id: "job-1" } })
    expect((await first).success).toBe(true)
    expect(aiRequestState.inProgress).toBe(false)
  })

  it("releases the guard after an unauthenticated request without calling the API", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } })
    expect((await buildSegmentsWithAI(params)).error).toContain("Authentication required")
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(aiRequestState.inProgress).toBe(false)
  })

  it("releases the guard on API failure so a later request can retry", async () => {
    jest.mocked(apiClient.post).mockRejectedValueOnce(new Error("Service unavailable"))
    expect((await buildSegmentsWithAI(params)).success).toBe(false)
    expect(aiRequestState.inProgress).toBe(false)
  })
})