import {
  mapChatCommandStatus,
  withMappedCommandStatus,
} from "@/app/services/map-chat-command-status"
import { shouldTreatInterventionAsFailed } from "@/app/services/intervention-request"

describe("shouldTreatInterventionAsFailed", () => {
  it("does not treat 2xx accepted with workflowId as failed", () => {
    expect(
      shouldTreatInterventionAsFailed({
        success: true,
        data: {
          conversation_id: "conv-1",
          message: { message_id: "msg-1" },
          channel_send: { success: true, method: "whatsapp", workflowId: "wf-1" },
        },
      })
    ).toBe(false)
  })

  it("does not treat web channel (method none) as failed", () => {
    expect(
      shouldTreatInterventionAsFailed({
        success: true,
        data: {
          channel_send: { success: true, method: "none" },
        },
      })
    ).toBe(false)
  })

  it("treats 2xx as failed only when Temporal never started", () => {
    expect(
      shouldTreatInterventionAsFailed({
        success: true,
        data: {
          message: { message_id: "msg-1" },
          channel_send: {
            success: false,
            method: "whatsapp",
            error: "No phone",
          },
        },
      })
    ).toBe(true)
  })
})

describe("mapChatCommandStatus", () => {
  it("maps Temporal status failed to command_status for retry UI", () => {
    expect(mapChatCommandStatus({ status: "failed" })).toBe("failed")
    expect(withMappedCommandStatus({ status: "failed" })?.command_status).toBe("failed")
  })

  it("prefers explicit command_status from Temporal", () => {
    expect(mapChatCommandStatus({ status: "sent", command_status: "success" })).toBe("success")
    expect(mapChatCommandStatus({ command_status: "pending", status: "pending" })).toBe("pending")
  })

  it("does not mark pending or sent rows as failed", () => {
    expect(mapChatCommandStatus({ status: "pending" })).toBeUndefined()
    expect(mapChatCommandStatus({ status: "sent" })).toBeUndefined()
  })
})
