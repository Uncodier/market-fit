import { act, renderHook } from "@testing-library/react"
import { useNewCustomerSupportConversation } from "@/app/hooks/useNewCustomerSupportConversation"

const mockPush = jest.fn()
const mockCreateConversation = jest.fn()
const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockError = jest.fn()
let mockUser: { id: string } | null = { id: "user-1" }
let mockSite: { id: string } | null = { id: "site-1" }

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: mockUser }),
}))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockSite }),
}))
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: mockEq }) }),
  }),
}))
jest.mock("@/app/services/chat-service", () => ({
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
}))
jest.mock("react-hot-toast", () => ({ toast: { error: (...args: unknown[]) => mockError(...args) } }))

describe("new Customer Support conversation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { id: "user-1" }
    mockSite = { id: "site-1" }
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: "support-1", name: "Customer Support" }, error: null })
    mockCreateConversation.mockResolvedValue({ id: "conversation-1" })
  })

  it("creates a direct conversation with the site's support agent without a selected conversation", async () => {
    const { result } = renderHook(() => useNewCustomerSupportConversation())
    await act(async () => { await result.current.startConversation() })

    expect(mockEq).toHaveBeenCalledWith("site_id", "site-1")
    expect(mockEq).toHaveBeenCalledWith("role", "Customer Support")
    expect(mockCreateConversation).toHaveBeenCalledWith(
      "site-1", "user-1", "support-1", "Direct chat with Customer Support",
      { is_agent_conversation: true }
    )
    expect(mockPush).toHaveBeenCalledWith(
      "/chat?agentId=support-1&agentName=Customer+Support&conversationId=conversation-1"
    )
    expect(result.current.isCreating).toBe(false)
  })

  it("does not create a conversation when the site's support agent is missing", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useNewCustomerSupportConversation())
    await act(async () => { await result.current.startConversation() })
    expect(mockCreateConversation).not.toHaveBeenCalled()
    expect(mockError).toHaveBeenCalledWith("Customer Support agent not found for this site.")
    expect(mockPush).not.toHaveBeenCalled()
  })

  it.each([null, "rejection"])("does not navigate to a fake conversation on failure: %s", async (failure) => {
    if (failure) mockCreateConversation.mockRejectedValue(new Error("Database unavailable"))
    else mockCreateConversation.mockResolvedValue(null)
    const { result } = renderHook(() => useNewCustomerSupportConversation())
    await act(async () => { await result.current.startConversation() })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockError).toHaveBeenCalledWith("Failed to create conversation. Please try again.")
    expect(result.current.isCreating).toBe(false)
  })

  it("requires a signed-in user and a selected site", async () => {
    mockUser = null
    mockSite = null
    const { result } = renderHook(() => useNewCustomerSupportConversation())
    await act(async () => { await result.current.startConversation() })
    expect(mockEq).not.toHaveBeenCalled()
    expect(mockCreateConversation).not.toHaveBeenCalled()
    expect(mockError).toHaveBeenCalled()
  })

  it("ignores repeated clicks while creation is in flight", async () => {
    const { result } = renderHook(() => useNewCustomerSupportConversation())
    await act(async () => {
      await Promise.all([result.current.startConversation(), result.current.startConversation()])
    })
    expect(mockCreateConversation).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })
})