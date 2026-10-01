import { act, renderHook, waitFor } from "@testing-library/react"
import { apiClient } from "@/app/services/api-client-service"
import { matchSenderPhoneNumbers, useZavuSenderPhoneNumbers } from "@/app/components/settings/use-zavu-sender-phone-numbers"

let currentSiteId = "site-1"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: currentSiteId } }) }))

describe("sender phone-number lookup", () => {
  beforeEach(() => { currentSiteId = "site-1" })
  afterEach(() => jest.restoreAllMocks())

  it("uses only a uniquely matching sender or phone ID; never guesses from an unrelated number", () => {
    const connections = [
      { zavu_sender_id: "sender-a", metadata: { phone_number_id: "number-1" } },
      { zavu_sender_id: "sender-b" },
      { zavu_sender_id: "sender-c", metadata: { phone_number_id: "number-3" } },
    ]
    expect(matchSenderPhoneNumbers(connections, [
      { id: "number-1", phoneNumber: "+14155550100", senderId: "sender-a" },
      { id: "number-2", phoneNumber: "+14155550200", senderId: "sender-b" },
      { id: "number-3", phoneNumber: "+14155550300", senderId: "sender-other" },
      { id: "number-4", phoneNumber: "+14155550400" },
    ])).toEqual({ "sender-a": "+14155550100", "sender-b": "+14155550200" })
    expect(matchSenderPhoneNumbers([
      { zavu_sender_id: "sender-a", metadata: { phone_number_id: "number-1" } },
    ], [
      { id: "number-1", phoneNumber: "+14155550100" },
      { id: "number-1", phoneNumber: "+14155550500" },
    ])).toEqual({})
    expect(matchSenderPhoneNumbers([
      { zavu_sender_id: "shared", metadata: { phone_number_id: "number-1" } },
      { zavu_sender_id: "shared", metadata: { phone_number_id: "number-2" } },
    ], [
      { id: "number-1", phoneNumber: "+14155550100", senderId: "shared" },
      { id: "number-2", phoneNumber: "+14155550200", senderId: "shared" },
    ])).toEqual({})
  })

  it("reads the linked WhatsApp number rather than the purchased-number inventory", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: { id: "sender-a", whatsapp: { displayPhoneNumber: "+14155550100" } },
    })
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [{ status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }],
      enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({ "whatsapp:sender-a": "+14155550100" }))
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith(
      "/api/integrations/zavu/senders/sender-a?siteId=site-1",
      { timeout: 10000 },
    )
  })

  it("looks up numbers for active and synced connections too", async () => {
    currentSiteId = "site-1"
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ success: true, data: [{ id: "number-1", phoneNumber: "+14155550100", senderId: "sender-a" }] })
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [{ status: "active", type: "voice", zavu_sender_id: "sender-a" }],
      enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({ "voice:sender-a": "+14155550100" }))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it("uses the existing site-scoped GET once even when no sender number matches", async () => {
    currentSiteId = "site-1"
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ success: true, data: [{ id: "unrelated", phoneNumber: "+14155550000" }] })
    const connections = [{ status: "connected", type: "voice", zavu_sender_id: "sender-a" }]
    const { result, rerender } = renderHook(({ items }) => useZavuSenderPhoneNumbers({ connections: items, enabled: true }), {
      initialProps: { items: connections },
    })
    await waitFor(() => expect(get).toHaveBeenCalledWith(
      "/api/integrations/zavu/phone-numbers?siteId=site-1", { timeout: 10000 },
    ))
    await act(async () => { await Promise.resolve() })
    rerender({ items: [{ ...connections[0] }] })
    await act(async () => { await Promise.resolve() })
    expect(get).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({})
  })

  it("keeps WhatsApp and Voice numbers separate even when they share a sender", async () => {
    const get = jest.spyOn(apiClient, "get").mockImplementation(async (url) => ({
      success: true,
      data: url.includes("/senders/")
        ? { id: "shared", whatsapp: { displayPhoneNumber: "+14155550100" } }
        : [{ id: "number-1", phoneNumber: "+14155550200", senderId: "shared" }],
    }))
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [
        { status: "connected", type: "whatsapp", zavu_sender_id: "shared" },
        { status: "connected", type: "voice", zavu_sender_id: "shared" },
      ],
      enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({
      "whatsapp:shared": "+14155550100", "voice:shared": "+14155550200",
    }))
    expect(get).toHaveBeenCalledTimes(2)
  })

  it.each([
    { success: false, status: 403 },
    { success: true, data: { id: "sender-a", whatsapp: { displayPhoneNumber: null } } },
    { success: true, data: { id: "sender-a", phoneNumber: "+14155550999" } },
    { success: true, data: { id: "other-sender", whatsapp: { displayPhoneNumber: "+14155550999" } } },
  ])("does not guess or repeatedly fetch a missing WhatsApp number (%#)", async (response) => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue(response)
    const connections = [{ status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }]
    const { result, rerender } = renderHook(({ items }) => useZavuSenderPhoneNumbers({
      connections: items, enabled: true,
    }), { initialProps: { items: connections } })
    await act(async () => { await Promise.resolve() })
    rerender({ items: [{ ...connections[0] }] })
    await act(async () => { await Promise.resolve() })
    expect(result.current).toEqual({})
    expect(get).toHaveBeenCalledTimes(1)
  })

  it("skips stored numbers, inactive connections, and disabled sections", () => {
    const get = jest.spyOn(apiClient, "get")
    const connections = [
      { status: "connected", type: "whatsapp", zavu_sender_id: "stored", connected_account: { phoneNumber: "+14155550100" } },
      { status: "pending", type: "whatsapp", zavu_sender_id: "pending" },
      { status: "disconnected", type: "whatsapp", zavu_sender_id: "disconnected" },
      { status: "connected", type: "whatsapp" },
    ]
    renderHook(() => useZavuSenderPhoneNumbers({ connections, enabled: true }))
    renderHook(() => useZavuSenderPhoneNumbers({
      connections: [{ status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }], enabled: false,
    }))
    expect(get).not.toHaveBeenCalled()
  })

  it("deduplicates lookups for repeated WhatsApp senders", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true, data: { id: "sender-a", whatsapp: { displayPhoneNumber: "+14155550100" } },
    })
    const connection = { status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [connection, { ...connection }], enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({ "whatsapp:sender-a": "+14155550100" }))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it("keeps a resolved WhatsApp number when the Voice lookup throws", async () => {
    jest.spyOn(apiClient, "get").mockImplementation(async (url) => {
      if (!url.includes("/senders/")) throw new Error("Network unavailable")
      return { success: true, data: { id: "sender-a", whatsapp: { displayPhoneNumber: "+14155550100" } } }
    })
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [
        { status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" },
        { status: "connected", type: "voice", zavu_sender_id: "sender-b" },
      ], enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({ "whatsapp:sender-a": "+14155550100" }))
  })

  it("discards a delayed lookup after the connection is removed", async () => {
    let resolveLookup!: (value: Awaited<ReturnType<typeof apiClient.get>>) => void
    jest.spyOn(apiClient, "get").mockImplementation(() => new Promise((resolve) => { resolveLookup = resolve }))
    const { result, rerender } = renderHook(({ connected }) => useZavuSenderPhoneNumbers({
      connections: connected ? [{ status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }] : [],
      enabled: true,
    }), { initialProps: { connected: true } })
    rerender({ connected: false })
    await act(async () => {
      resolveLookup({ success: true, data: { id: "sender-a", whatsapp: { displayPhoneNumber: "+14155550100" } } })
    })
    expect(result.current).toEqual({})
  })

  it("ignores an old site's delayed response and clears numbers on site change", async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof apiClient.get>>) => void
    const get = jest.spyOn(apiClient, "get")
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValue({ success: true, data: { id: "sender-a", whatsapp: { displayPhoneNumber: "+14155550200" } } })
    const { result, rerender } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [{ status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }], enabled: true,
    }))
    currentSiteId = "site-2"
    rerender()
    expect(result.current).toEqual({})
    await waitFor(() => expect(result.current).toEqual({ "whatsapp:sender-a": "+14155550200" }))
    await act(async () => {
      resolveOld({ success: true, data: { id: "sender-a", whatsapp: { displayPhoneNumber: "+14155550100" } } })
    })
    expect(result.current).toEqual({ "whatsapp:sender-a": "+14155550200" })
    expect(get).toHaveBeenCalledTimes(2)
    currentSiteId = ""
    rerender()
    expect(result.current).toEqual({})
    expect(get).toHaveBeenCalledTimes(2)
  })
})