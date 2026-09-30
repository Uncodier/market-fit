import {
  mapChatCommandStatus,
  withMappedCommandStatus,
} from "@/app/services/map-chat-command-status"
import {
  getInterventionWorkflowId,
  shouldTreatInterventionAsFailed,
} from "@/app/services/intervention-request"

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

  it.each([
    ["workflowId", { workflowId: "wf-1" }],
    ["workflow_id", { workflow_id: "wf-1" }],
    ["workflowRunId", { workflowRunId: "run-1" }],
    ["run_id", { run_id: "run-1" }],
  ])("accepts the %s Temporal identifier shape", (_name, identifier) => {
    const channelSend = { success: false, method: "sms", ...identifier }
    expect(getInterventionWorkflowId(channelSend)).toBe(Object.values(identifier)[0])
    expect(shouldTreatInterventionAsFailed({
      success: true,
      data: { channel_send: channelSend },
    })).toBe(false)
  })
})

describe("mapChatCommandStatus", () => {
  it('does not leave completed voice interventions pending on older rows', () => {
    expect(mapChatCommandStatus({ voice_mode: 'agent_call', call_status: 'completed', command_status: 'pending' })).toBe('success')
  })

  it('preserves unknown call placement instead of presenting a retryable failure', () => {
    expect(mapChatCommandStatus({ voice_mode: 'agent_call', call_status: 'placement_unknown', command_status: 'failed' })).toBe('pending')
  })

  it('maps terminal voice failures without waiting for a command_status update', () => {
    expect(mapChatCommandStatus({ voice_mode: 'agent_call', call_status: 'no_answer', command_status: 'pending' })).toBe('failed')
  })

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
