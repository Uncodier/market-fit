import { describe, expect, it } from "@jest/globals"
import {
  ImprentaContractValidationError,
  strengthenImprentaAssistantPayload,
} from "@/app/api/robots/instance/assistant/imprenta-contract"
import { SPEECH_LANGUAGE_VALUES, SPEECH_VOICE_VALUES } from "@/lib/ai/speech-options"

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

  it("binds explicit persisted speech selections over stale context and overrides", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: JSON.stringify({ parameters: { voice: "echo", language: "en" } }),
      tool_overrides: {
        generate_audio: { voice: "alloy", language: "fr", speed: 1.2 },
        generate_video: { duration: 8 },
        publish: { is_test: true },
      },
    }, {
      ...node,
      type: "generate-audio",
      settings: { parameters: { voice: " NOVA ", language: " ES ", format: "aac" } },
    })
    expect(result.tool_overrides).toEqual({
      generate_audio: { voice: "nova", language: "es", speed: 1.2, format: "aac" },
      publish: { is_test: true },
    })
    expect(JSON.parse(String(result.context)).parameters).toEqual({
      voice: "nova", language: "es", format: "aac",
    })
  })

  it.each([{}, { voice: undefined, language: undefined }, { voice: "auto", language: "auto" }, { format: "mp3" }])(
    "clears stale overrides and context for saved default/auto parameters %j", (parameters) => {
      const result = strengthenImprentaAssistantPayload({
        instance_node_id: node.id,
        context: JSON.stringify({ parameters: { voice: "fable", language: "ru" } }),
        tool_overrides: { generate_audio: { voice: "echo", language: "fr", speed: 1 } },
      }, { ...node, type: "generate-audio", settings: { parameters } })
      const override = (result.tool_overrides as Record<string, Record<string, unknown>>).generate_audio
      expect(override).not.toHaveProperty("voice")
      expect(override).not.toHaveProperty("language")
      expect(override.speed).toBe(1)
      expect(JSON.parse(String(result.context)).parameters).toMatchObject({ voice: "auto", language: "auto" })
    },
  )

  it("resets only the auto field while enforcing the explicitly selected field", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { nodeType: "generate-audio", parameters: { voice: "auto", language: "ja" } },
      tool_overrides: { generate_audio: { voice: "echo", language: "en" } },
    })
    expect(result.tool_overrides).toEqual({ generate_audio: { language: "ja" } })
  })

  it("uses explicit context parameters only when persisted parameters are absent", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { parameters: { voice: "shimmer", language: "uk" } },
      tool_overrides: { generate_audio: { voice: "echo", language: "en" } },
    }, { ...node, type: "generate-audio", settings: {} })
    expect(result.tool_overrides).toEqual({ generate_audio: { voice: "shimmer", language: "uk" } })
  })

  it("resets fallback context defaults without forcing model speech choices", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { nodeType: "generate-audio", parameters: {} },
      tool_overrides: { generate_audio: { voice: "alloy", language: "en" } },
    })
    expect(result.tool_overrides).toEqual({ generate_audio: {} })
    expect(JSON.parse(String(result.context)).parameters).toEqual({ voice: "auto", language: "auto" })
  })

  it("leaves default nodes with no selections unbound", () => {
    const result = strengthenImprentaAssistantPayload({ instance_node_id: node.id }, {
      ...node, type: "generate-audio", settings: {},
    })
    expect(result.tool_overrides).toEqual({ generate_audio: {} })
    expect(JSON.parse(String(result.context))).not.toHaveProperty("parameters")
  })

  it("preserves valid explicit legacy overrides without inventing default parameters", () => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      tool_overrides: { generate_audio: { voice: " ONYX ", language: " DE ", format: "ogg" } },
    }, { ...node, type: "generate-audio", settings: {} })
    expect(result.tool_overrides).toEqual({ generate_audio: { voice: "onyx", language: "de", format: "opus" } })
    expect(JSON.parse(String(result.context))).not.toHaveProperty("parameters")
    expect(strengthenImprentaAssistantPayload(result, {
      ...node, type: "generate-audio", settings: {},
    }).tool_overrides).toEqual(result.tool_overrides)
    const auto = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { nodeType: "generate-audio" },
      tool_overrides: { generate_audio: { voice: "auto", language: "auto" } },
    })
    expect(auto.tool_overrides).toEqual({ generate_audio: {} })
  })

  it.each(SPEECH_VOICE_VALUES)("accepts supported voice %s", (voice) => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { nodeType: "generate-audio", parameters: { voice } },
    })
    expect(result.tool_overrides).toEqual({ generate_audio: voice === "auto" ? {} : { voice } })
  })

  it.each(SPEECH_LANGUAGE_VALUES)("accepts supported language %s", (language) => {
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { nodeType: "generate-audio", parameters: { language } },
    })
    expect(result.tool_overrides).toEqual({ generate_audio: language === "auto" ? {} : { language } })
  })

  it.each(["mp3", "pcm", "wav", "opus", "aac", "flac", "ogg"])(
    "normalizes the actual audio format %s", (format) => {
      const result = strengthenImprentaAssistantPayload({
        instance_node_id: node.id,
        context: { nodeType: "generate-audio", parameters: { format: format.toUpperCase() } },
      })
      expect(result.tool_overrides).toEqual({ generate_audio: { format: format === "ogg" ? "opus" : format } })
    },
  )

  it.each(["unsupported", "", "   ", 42, false, null, {}, ["nova"]])(
    "rejects invalid speech selections %j with a safe 400 error", (value) => {
      for (const field of ["voice", "language"]) {
        const build = () => strengthenImprentaAssistantPayload({
          instance_node_id: node.id,
          context: { nodeType: "generate-audio", parameters: { [field]: value } },
        })
        expect(build).toThrow(ImprentaContractValidationError)
        try { build() } catch (error) {
          expect((error as ImprentaContractValidationError).status).toBe(400)
        }
      }
    },
  )

  it("rejects invalid legacy overrides but ignores stale invalid selections on reset", () => {
    expect(() => strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { nodeType: "generate-audio" },
      tool_overrides: { generate_audio: { voice: 42 } },
    })).toThrow(ImprentaContractValidationError)
    const result = strengthenImprentaAssistantPayload({
      instance_node_id: node.id,
      context: { parameters: { voice: 42, language: false } },
      tool_overrides: { generate_audio: { voice: {}, language: [] } },
    }, { ...node, type: "generate-audio", settings: { parameters: {} } })
    expect(result.tool_overrides).toEqual({ generate_audio: {} })
  })

  it("leaves non-node assistant requests untouched", () => {
    const payload = { message: "Hello" }
    expect(strengthenImprentaAssistantPayload(payload)).toBe(payload)
  })
})
