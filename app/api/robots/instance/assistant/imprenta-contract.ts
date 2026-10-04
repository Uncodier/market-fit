import { SPEECH_LANGUAGE_VALUES, SPEECH_VOICE_VALUES } from "@/lib/ai/speech-options"

type JsonRecord = Record<string, unknown>

export class ImprentaContractValidationError extends Error {
  readonly status = 400

  constructor(field: "voice" | "language") {
    super(`Speech ${field} must be auto or a supported ${field}`)
    this.name = "ImprentaContractValidationError"
  }
}

export interface ImprentaNodeSnapshot {
  id: string
  instance_id: string
  site_id: string
  type: string
  prompt: JsonRecord | null
  settings: JsonRecord | null
  updated_at: string
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function parseContext(value: unknown): JsonRecord {
  if (typeof value !== "string") return record(value)
  try {
    return record(JSON.parse(value))
  } catch {
    return {}
  }
}

function canonicalOutputType(value: unknown): "image" | "video" | "audio" | "text" | null {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("_", "-")
    : ""
  if (normalized === "image" || normalized === "generate-image") return "image"
  if (normalized === "video" || normalized === "generate-video") return "video"
  if (normalized === "audio" || normalized === "generate-audio") return "audio"
  if (normalized === "text" || normalized === "prompt") return "text"
  return null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function parameterRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

function speechSelection(
  value: unknown,
  values: readonly string[],
  field: "voice" | "language",
): string | undefined {
  if (value === undefined) return undefined
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!values.includes(normalized)) throw new ImprentaContractValidationError(field)
  return normalized === "auto" ? undefined : normalized
}

function audioSelections(parameters: JsonRecord): JsonRecord {
  const voice = speechSelection(parameters.voice, SPEECH_VOICE_VALUES, "voice")
  const language = speechSelection(parameters.language, SPEECH_LANGUAGE_VALUES, "language")
  return { voice: voice ?? "auto", language: language ?? "auto" }
}

function normalizeParameters(value: unknown): JsonRecord {
  const source = record(value)
  const aspectRatio = stringValue(
    source.aspect_ratio ?? source.aspectRatio ?? source.ratio
  )
  const durationSeconds = numberValue(
    source.duration_seconds ?? source.durationSeconds ?? source.duration
  )

  return {
    ...source,
    ...(aspectRatio
      ? { aspect_ratio: aspectRatio, aspectRatio }
      : {}),
    ...(durationSeconds !== undefined
      ? { duration_seconds: durationSeconds, duration: durationSeconds }
      : {}),
  }
}

function mediaOverrides(
  outputType: "image" | "video" | "audio" | "text",
  parameters: JsonRecord,
): { toolName: string; values: JsonRecord } | null {
  const aspectRatio = stringValue(parameters.aspect_ratio)
  if (outputType === "image") {
    const quality = parameters.quality === "standard" || parameters.quality === "hd"
      ? parameters.quality
      : typeof parameters.quality === "number"
        ? parameters.quality >= 85 ? "hd" : "standard"
        : undefined
    return {
      toolName: "generate_image",
      values: {
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(quality ? { quality } : {}),
      },
    }
  }
  if (outputType === "video") {
    const quality = ["preview", "standard", "pro"].includes(String(parameters.quality))
      ? parameters.quality
      : parameters.resolution === "1080p"
        ? "pro"
        : parameters.resolution === "720p"
          ? "standard"
          : undefined
    const proQuality = quality === "pro"
    const duration = proQuality ? 8 : numberValue(parameters.duration_seconds)
    return {
      toolName: "generate_video",
      values: {
        ...(proQuality ? { aspect_ratio: "16:9" } : aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(duration !== undefined ? { duration } : {}),
        ...(quality ? { quality } : {}),
      },
    }
  }
  if (outputType === "audio") {
    const rawFormat = stringValue(parameters.format)?.trim().toLowerCase()
    const format = rawFormat === "ogg"
      ? "opus"
      : ["mp3", "pcm", "wav", "opus", "aac", "flac"].includes(rawFormat ?? "")
        ? rawFormat : undefined
    const selections = audioSelections(parameters)
    return {
      toolName: "generate_audio",
      values: {
        ...(format ? { format } : {}),
        ...(selections.voice !== "auto" ? { voice: selections.voice } : {}),
        ...(selections.language !== "auto" ? { language: selections.language } : {}),
      },
    }
  }
  return null
}

export function strengthenImprentaAssistantPayload(
  body: JsonRecord,
  node?: ImprentaNodeSnapshot,
): JsonRecord {
  if (typeof body.instance_node_id !== "string") return body

  const incomingContext = parseContext(body.context)
  const settings = record(node?.settings)
  const outputType =
    canonicalOutputType(node?.type)
    ?? canonicalOutputType(incomingContext.nodeType)
    ?? canonicalOutputType(incomingContext.output_type)
    ?? canonicalOutputType(incomingContext.media_type)
    ?? canonicalOutputType(incomingContext.mediaType)
    ?? canonicalOutputType(settings.output_type)
    ?? canonicalOutputType(settings.media_type)
  if (!outputType) return body

  const audioParameters = parameterRecord(settings.parameters)
    ?? parameterRecord(incomingContext.parameters)
  const parameters = normalizeParameters({
    ...record(incomingContext.parameters),
    ...record(settings.parameters),
    ...(outputType === "audio" && audioParameters
      ? audioSelections(audioParameters)
      : {}),
  })
  const allowedMediaTool = outputType === "image"
    ? "generate_image"
    : outputType === "video"
      ? "generate_video"
      : outputType === "audio"
        ? "generate_audio"
        : null
  const mediaTools = new Set(["generate_image", "generate_video", "generate_audio"])
  const incomingOverrides = Object.fromEntries(
    Object.entries(record(body.tool_overrides)).filter(([toolName]) =>
      !mediaTools.has(toolName) || toolName === allowedMediaTool),
  )
  const allowedOverride = allowedMediaTool
    ? record(incomingOverrides[allowedMediaTool])
    : {}
  if (outputType === "audio") {
    // Auto/default means the agent chooses; never keep a stale forced selection.
    const remaining = { ...allowedOverride }
    delete remaining.voice
    delete remaining.language
    delete remaining.format
    incomingOverrides.generate_audio = remaining
  }
  const override = mediaOverrides(outputType, {
    ...(outputType === "audio" ? allowedOverride : {}),
    ...parameters,
    ...(parameters.quality === undefined && allowedOverride.quality !== undefined
      ? { quality: allowedOverride.quality }
      : {}),
  })
  const toolOverrides = override
    ? {
        ...incomingOverrides,
        [override.toolName]: {
          ...record(incomingOverrides[override.toolName]),
          ...override.values,
        },
      }
    : incomingOverrides
  const persistedPrompt = stringValue(record(node?.prompt).text)
  const expectedResults = numberValue(parameters.expectedResults)

  return {
    ...body,
    ...(node
      ? {
          instance_id: node.instance_id,
          site_id: node.site_id,
        }
      : {}),
    ...(persistedPrompt ? { message: persistedPrompt } : {}),
    ...(expectedResults !== undefined
      ? { expected_results_amount: Math.max(1, Math.min(20, Math.trunc(expectedResults))) }
      : {}),
    context: JSON.stringify({
      ...incomingContext,
      nodeType: node?.type ?? incomingContext.nodeType,
      mediaType: outputType,
      media_type: outputType,
      output_type: outputType,
      // Do not invent a parameter object for legacy audio overrides: the API
      // distinguishes an absent object from a saved object with auto defaults.
      parameters: outputType === "audio" && !audioParameters ? undefined : parameters,
      ui_contract: {
        version: 1,
        output_type: outputType,
        ...(node?.updated_at ? { node_updated_at: node.updated_at } : {}),
      },
    }),
    ...(Object.keys(toolOverrides).length > 0
      ? { tool_overrides: toolOverrides }
      : {}),
  }
}
