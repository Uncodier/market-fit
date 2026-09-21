import { describe, expect, it } from "@jest/globals"
import { strengthenImprentaAssistantPayload } from "@/app/api/robots/instance/assistant/imprenta-contract"

const node = {
  id: "22222222-2222-4222-8222-222222222222",
  instance_id: "33333333-3333-4333-8333-333333333333",
  site_id: "44444444-4444-4444-8444-444444444444",
  type: "generate-image",
  prompt: { text: "Create the requested still image" },
  settings: {
    media_type: "image",
    parameters: {
      aspectRatio: "9:16",
      expectedResults: 1,
      quality: "hd",
    },
  },
  updated_at: "2026-09-21T20:00:00.000Z",
}

describe("strengthenImprentaAssistantPayload", () => {
  it("uses the persisted UI node as the authoritative execution snapshot", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      instance_id: node.instance_id,
      site_id: node.site_id,
      message: "Generate a video from stale state",
      context: JSON.stringify({
        nodeType: "generate-video",
        mediaType: "video",
        parameters: { aspectRatio: "16:9" },
      }),
    }, node)

    expect(result.message).toBe("Create the requested still image")
    expect(result.expected_results_amount).toBe(1)
    expect(result.tool_overrides).toEqual({
      generate_image: { aspect_ratio: "9:16", quality: "hd" },
    })

    const context = JSON.parse(String(result.context))
    expect(context).toMatchObject({
      nodeType: "generate-image",
      mediaType: "image",
      media_type: "image",
      output_type: "image",
      parameters: {
        aspectRatio: "9:16",
        aspect_ratio: "9:16",
      },
      ui_contract: {
        version: 1,
        output_type: "image",
        node_updated_at: node.updated_at,
      },
    })
  })

  it("normalizes video parameters into enforced tool overrides", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: JSON.stringify({
        nodeType: "generate-video",
        parameters: {
          durationSeconds: 6,
          aspectRatio: "9:16",
          quality: "standard",
        },
      }),
      tool_overrides: {
        publish: { is_test: true },
      },
    })

    expect(result.tool_overrides).toEqual({
      publish: { is_test: true },
      generate_video: {
        aspect_ratio: "9:16",
        duration: 6,
        quality: "standard",
      },
    })
  })

  it("maps 1080p video settings to the supported pro contract", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: JSON.stringify({
        nodeType: "generate-video",
        parameters: {
          resolution: "1080p",
          duration: 4,
          aspectRatio: "9:16",
        },
      }),
      tool_overrides: {
        generate_image: { quality: "hd" },
      },
    })

    expect(result.tool_overrides).toEqual({
      generate_video: {
        aspect_ratio: "16:9",
        duration: 8,
        quality: "pro",
      },
    })
  })

  it("normalizes audio formats supported by the generation tool", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: JSON.stringify({
        nodeType: "generate-audio",
        parameters: { format: "WAV" },
      }),
    })

    expect(result.tool_overrides).toEqual({
      generate_audio: { format: "wav" },
    })
  })

  it("leaves non-node assistant requests untouched", () => {
    const payload = { message: "Hello" }
    expect(strengthenImprentaAssistantPayload(payload)).toBe(payload)
  })
})
