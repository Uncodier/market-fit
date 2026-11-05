import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { SmsChannelSetup } from "@/app/components/settings/SmsChannelSetup"
import { normalizeSmsSetupResponse } from "@/app/components/settings/sms-setup-readiness"

const get = jest.fn()
const post = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({ apiClient: {
  get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args),
} }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }))

const selected = { id: "number-1", phoneNumber: "+14155550100", name: "Test number", capabilities: ["sms" as const], regulatoryStatus: "approved" }

beforeEach(() => {
  jest.clearAllMocks()
  get.mockResolvedValue({ success: true, data: [selected] })
})

it.each([
  { status: "in_progress", activationPending: true },
  { status: "connected", activationPending: true },
  { status: "connected" },
  { status: "connected", activationPending: false, regulatoryStatus: "pending_review" },
  { status: "connected", activationPending: false, regulatoryStatus: "rejected" },
  {},
])("does not fabricate connected readiness (%#)", (responseData) => {
  expect(normalizeSmsSetupResponse({ selected, responseData }).status).not.toBe("connected")
})

it("prefers API readiness and metadata over a stale selected phone number", () => {
  expect(normalizeSmsSetupResponse({
    selected: { ...selected, regulatoryStatus: "pending_review" },
    responseData: { senderId: "sender-1", status: "connected", activationPending: false, regulatoryStatus: "approved", phoneNumberId: "canonical-id" },
  })).toEqual(expect.objectContaining({ status: "connected", activationPending: false, regulatoryStatus: "approved", phoneNumberId: "canonical-id" }))
})

it("accepts canonical completed activation even when cached phone review is stale", () => {
  expect(normalizeSmsSetupResponse({
    selected: { ...selected, regulatoryStatus: "pending_review" },
    responseData: { senderId: "sender-1", status: "connected", activationPending: false },
  }).status).toBe("connected")
})

async function submit(onConnected: jest.Mock) {
  render(<SmsChannelSetup siteId="site-1" channel={{ id: "sms-1", name: "SMS" }} onConnected={onConnected} />)
  fireEvent.click(await screen.findByText("Test number"))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Activate SMS Channel" })) })
}

it("does not update the connection or toast success after SMS activation rejection", async () => {
  post.mockResolvedValue({ success: false, status: 502, error: { message: "SMS activation failed" } })
  const onConnected = jest.fn()
  await submit(onConnected)
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("SMS activation failed"))
  expect(onConnected).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it("adopts canonical pending SMS status despite an approved number in the selector", async () => {
  post.mockResolvedValue({ success: true, data: { senderId: "sender-1", status: "in_progress", activationPending: true } })
  const onConnected = jest.fn()
  await submit(onConnected)
  await waitFor(() => expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress", activationPending: true })))
  expect(toast.success).not.toHaveBeenCalled()
})

it("shows SMS success only after the API confirms completed activation", async () => {
  post.mockResolvedValue({ success: true, data: { senderId: "sender-1", status: "connected", activationPending: false } })
  const onConnected = jest.fn()
  await submit(onConnected)
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("SMS channel connected successfully."))
  expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ status: "connected", activationPending: false }))
})