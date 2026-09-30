export const PUBLISH_SLOT_CONTENT = "content"
/** Generic / normal context links (style, reference, etc.) */
export const PUBLISH_SLOT_REFERENCE = "reference"
export const PUBLISH_SLOT_AUDIENCE = "audience"

/** Vertical anchor position as fraction of card height (from top). */
export const PUBLISH_ANCHOR_CONTENT_Y = 0.2
export const PUBLISH_ANCHOR_CONTEXT_Y = 0.5
export const PUBLISH_ANCHOR_AUDIENCE_Y = 0.8

export const PUBLISH_ANCHOR_LABELS = {
  content: "Content",
  context: "Context",
  audience: "Audience",
} as const

/** Creative / production context types used when assembling video, text and audio assets. */
export const IMPRENTA_CREATIVE_CONTEXT_TYPES = [
  // Narrative
  "scenario",
  "hero",
  "character",
  "setting",
  "theme",
  "plot",
  "dialogue",
  "tone",
  "script",
  // Visual
  "background",
  "colors",
  "mood",
  "lighting",
  "camera",
  "wardrobe",
  "props",
  "logo",
  "branding",
  // Audio
  "voice",
  "music",
  "sound",
  "pacing",
] as const

const CREATIVE_CONTEXT_TYPES_SET = new Set<string>(IMPRENTA_CREATIVE_CONTEXT_TYPES)

/** All relation types exposed in the edge selector, grouped for the dropdown UI. */
export type ImprentaContextRelationOption = { value: string; label: string }
export type ImprentaContextRelationGroup = {
  label: string
  options: ImprentaContextRelationOption[]
}

export const IMPRENTA_CONTEXT_RELATION_GROUPS: ImprentaContextRelationGroup[] = [
  {
    label: "General",
    options: [
      { value: PUBLISH_SLOT_REFERENCE, label: "Reference" },
      { value: "context", label: "Context" },
      { value: "style", label: "Style" },
      { value: "negative", label: "Negative" },
      { value: "data", label: "Data" },
    ],
  },
  {
    label: "Narrative",
    options: [
      { value: "scenario", label: "Scenario" },
      { value: "hero", label: "Hero" },
      { value: "character", label: "Character" },
      { value: "setting", label: "Setting" },
      { value: "theme", label: "Theme" },
      { value: "plot", label: "Plot" },
      { value: "dialogue", label: "Dialogue" },
      { value: "tone", label: "Tone" },
      { value: "script", label: "Script" },
    ],
  },
  {
    label: "Visual",
    options: [
      { value: "background", label: "Background" },
      { value: "colors", label: "Colors" },
      { value: "mood", label: "Mood" },
      { value: "lighting", label: "Lighting" },
      { value: "camera", label: "Camera" },
      { value: "wardrobe", label: "Wardrobe" },
      { value: "props", label: "Props" },
      { value: "logo", label: "Logo" },
      { value: "branding", label: "Branding" },
    ],
  },
  {
    label: "Audio",
    options: [
      { value: "voice", label: "Voice" },
      { value: "music", label: "Music" },
      { value: "sound", label: "Sound" },
      { value: "pacing", label: "Pacing" },
    ],
  },
  {
    label: "Routing",
    options: [
      { value: PUBLISH_SLOT_CONTENT, label: "Content" },
      { value: PUBLISH_SLOT_AUDIENCE, label: "Audience" },
      { value: "from", label: "From" },
      { value: "to", label: "To" },
    ],
  },
]

const CONTEXT_RELATION_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const group of IMPRENTA_CONTEXT_RELATION_GROUPS) {
    for (const opt of group.options) map[opt.value] = opt.label
  }
  return map
})()

/**
 * Human-readable label for a connection type.
 * Custom / free-form values typed by the user (containing uppercase letters or
 * spaces) are rendered verbatim; single-word lowercase values are title-cased.
 */
export function getContextRelationLabel(t: string | null | undefined): string {
  if (!t) return "Reference"
  const known = CONTEXT_RELATION_LABELS[t]
  if (known) return known
  if (/[A-Z\s]/.test(t)) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Types that attach to the middle “Context” anchor on Publish (normal relations). */
export function isNormalPublishContextType(t: string | null | undefined): boolean {
  if (t === PUBLISH_SLOT_CONTENT || t === PUBLISH_SLOT_AUDIENCE) return false
  if (t == null) return true
  if (
    t === PUBLISH_SLOT_REFERENCE ||
    t === "context" ||
    t === "style" ||
    t === "negative" ||
    t === "data" ||
    t === "from" ||
    t === "to"
  ) {
    return true
  }
  return CREATIVE_CONTEXT_TYPES_SET.has(t)
}

/** Label for the floating badge on wires into a Publish node. */
export function getPublishContextEdgeCaption(
  targetNodeType: string | undefined,
  connectionType: string | null | undefined
): string {
  if (targetNodeType !== "publish") return getContextRelationLabel(connectionType)
  if (connectionType === PUBLISH_SLOT_CONTENT) return PUBLISH_ANCHOR_LABELS.content
  if (connectionType === PUBLISH_SLOT_AUDIENCE) return PUBLISH_ANCHOR_LABELS.audience
  // Generic context edges collapse to the "Context" anchor label; specific
  // creative types (scenario, mood, ...) surface their own name so the graph
  // remains legible when multiple tools feed the same publish node.
  if (
    connectionType == null ||
    connectionType === PUBLISH_SLOT_REFERENCE ||
    connectionType === "context"
  ) {
    return PUBLISH_ANCHOR_LABELS.context
  }
  return getContextRelationLabel(connectionType)
}

export function getPublishContextAnchorY(
  targetNodeType: string | undefined,
  contextType: string | null | undefined,
  nodeHeight: number
): number {
  if (targetNodeType !== "publish") return nodeHeight / 2
  const t = contextType
  if (t === PUBLISH_SLOT_CONTENT) return nodeHeight * PUBLISH_ANCHOR_CONTENT_Y
  if (t === PUBLISH_SLOT_AUDIENCE) return nodeHeight * PUBLISH_ANCHOR_AUDIENCE_Y
  if (isNormalPublishContextType(t)) return nodeHeight * PUBLISH_ANCHOR_CONTEXT_Y
  return nodeHeight / 2
}

