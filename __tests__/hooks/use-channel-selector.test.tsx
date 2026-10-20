import { act, renderHook, waitFor } from "@testing-library/react"
import { useChannelSelector } from "@/app/hooks/useChannelSelector"
import type { SiteChannelSource } from "@/lib/site-channels"

let mockSite: SiteChannelSource | null
const mockSingle = jest.fn()
const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockSelect = jest.fn()

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ select: mockSelect, update: mockUpdate }) }) }))

const leadData = { id: "lead", phone: "+15551234567", email: "lead@example.test" }

describe("channel selector availability", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation(() => {})
    mockSite = null
    mockSingle.mockResolvedValue({ data: { channel: "whatsapp", custom_data: {} }, error: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  })
  afterEach(() => jest.restoreAllMocks())

  it.each([{ enabled: false }, { license_suspended: true }, { _license: { manually_disabled: true } },
    { status: "disabled", enabled: false, license_suspended: false, _license: { manually_disabled: true } }])("never resurrects a selected unavailable channel: %p", flags => {
    mockSite = { settings: { channels: { connections: [{ type: "whatsapp", status: "connected", ...flags }] } } }
    const { result } = renderHook(() => useChannelSelector({ leadData, defaultChannel: "whatsapp" }))
    expect(result.current.selectedChannel).toBe("whatsapp")
    expect(result.current.availableChannels).toEqual(["web"])
    act(() => { result.current.setSelectedChannel("whatsapp") })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("retains the stored conversation channel as history, not as availability", async () => {
    mockSite = { settings: { channels: { connections: [{ type: "whatsapp", status: "connected", _license: { manually_disabled: true } }] } } }
    const { result } = renderHook(() => useChannelSelector({ conversationId: "conversation", leadData }))
    await waitFor(() => expect(result.current.selectedChannel).toBe("whatsapp"))
    expect(result.current.availableChannels).toEqual(["web"])
    await act(async () => result.current.setSelectedChannel("web"))
    expect(result.current.selectedChannel).toBe("web")
    const reads = mockSingle.mock.calls.length
    await act(async () => result.current.setSelectedChannel("whatsapp"))
    expect(result.current.selectedChannel).toBe("web")
    expect(mockSingle).toHaveBeenCalledTimes(reads)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it("responds to manual disablement and explicit reactivation without altering historical selection", () => {
    mockSite = { settings: { channels: { connections: [{ type: "voice", status: "synced" }] } } }
    const { result, rerender } = renderHook(() => useChannelSelector({ leadData, defaultChannel: "voice" }))
    expect(result.current.availableChannels).toEqual(["web", "voice"])
    mockSite = { settings: { channels: { connections: [{ type: "voice", status: "synced", _license: { manually_disabled: true } }] } } }
    rerender()
    expect(result.current.selectedChannel).toBe("voice")
    expect(result.current.availableChannels).toEqual(["web"])
    mockSite = { settings: { channels: { connections: [{ type: "voice", status: "connected", enabled: true, _license: { manually_disabled: false } }] } } }
    rerender()
    expect(result.current.availableChannels).toEqual(["web", "voice"])
  })

  it("offers only web for agent-only conversations regardless of selection", () => {
    mockSite = { settings: { channels: { connections: [{ type: "email", status: "connected" }] } } }
    const { result } = renderHook(() => useChannelSelector({ leadData, defaultChannel: "email", isAgentOnlyConversation: true }))
    expect(result.current.availableChannels).toEqual(["web"])
  })

  it("still requires contact data and an active connection, not merely a default channel", () => {
    mockSite = { settings: { channels: { connections: [{ type: "whatsapp", status: "connected" }] } } }
    const { result } = renderHook(() => useChannelSelector({ leadData: { id: "lead" }, defaultChannel: "whatsapp" }))
    expect(result.current.availableChannels).toEqual(["web"])
  })
})