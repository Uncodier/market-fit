import type { InstanceNode } from "@/app/types/instance-nodes"

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

export function destinationsRequireAudience(dest: string[] | undefined): boolean {
  if (!dest?.length) return false
  return dest.some((d) => {
    const lower = d.toLowerCase()
    return lower === "mail" || lower === "whatsapp" || lower === "telegram" || lower === "audio" || lower === "voice" || lower === "newsletter" || lower === "sms" || lower === "mensaje" || lower === "message" || lower === "email"
  })
}

/** Accept hyphen or underscore (DB / clients may differ). */
export function isValidPublishAudienceSource(node: InstanceNode): boolean {
  const t = (node.type || "").trim().toLowerCase().replace(/_/g, "-")
  return t === "generate-audience" || (node.settings as any)?.media_type === "audience"
}

/**
 * Node sits under an Audience node in the canvas tree (walks up parent_node_id chain).
 */
export function isDescendantOfAudienceNode(node: InstanceNode, nodes: InstanceNode[]): boolean {
  let pid: string | null = node.parent_node_id
  const seen = new Set<string>()
  while (pid && !seen.has(pid)) {
    seen.add(pid)
    const parent = nodes.find((n) => n.id === pid)
    if (!parent) return false
    if (isValidPublishAudienceSource(parent)) return true
    pid = parent.parent_node_id
  }
  return false
}

/** Use Audience input (not Context) for Audience nodes and their child action nodes. */
export function shouldRouteToPublishAudienceSlot(node: InstanceNode, nodes: InstanceNode[]): boolean {
  return isValidPublishAudienceSource(node) || isDescendantOfAudienceNode(node, nodes)
}

/**
 * Content and Context anchors share the same rule: allow any source except Audience nodes
 * and nodes under an Audience parent (those belong on the Audience anchor).
 */
export function isValidPublishContentOrContextSource(node: InstanceNode, nodes: InstanceNode[]): boolean {
  return !shouldRouteToPublishAudienceSlot(node, nodes)
}

/**
 * Matches audience_id in markdown (`**audience_id:**`) or loose text.
 * JSON uses `"audience_id": "..."` — a quote may sit between `audience_id` and `:`.
 */
const AUDIENCE_ID_LINE_RE = /audience_id\s*[\s`*_]*\s*:/i
const AUDIENCE_ID_TYPO_RE = /audiencie_id\s*[\s`*_]*\s*:/i
/** JSON / YAML style keys */
const AUDIENCE_ID_JSON_KEY_RE =
  /(?:\\?["'`])?audience_id(?:\\?["'`])?\s*:|(?:\\?["'`])?audienceId(?:\\?["'`])?\s*:/i
/** LLM / markdown may insert zero-width or exotic spaces around `_` */
const AUDIENCE_ID_LOOSE_RE = /audience[\s\u200b\u200c\u200d\ufeff]*_[\s\u200b\u200c\u200d\ufeff]*id\s*:/i
/** Spanish copy sometimes uses "id de audiencia" */
const AUDIENCE_ID_ES_RE = /id\s+de\s+audiencia\s*:/i

function deepCollectStrings(value: unknown, out: string[] = []): string[] {
  if (value == null) return out
  if (typeof value === "string") {
    out.push(value)
    return out
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value))
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) deepCollectStrings(item, out)
    return out
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>
    for (const [k, v] of Object.entries(o)) {
      out.push(k)
      deepCollectStrings(v, out)
    }
  }
  return out
}

/** True if any nested object has a key audience_id or audienceId (structured API payloads). */
function objectGraphHasAudienceIdKey(value: unknown): boolean {
  const seen = new Set<unknown>()
  const walk = (v: unknown): boolean => {
    if (v == null) return false
    if (typeof v === "string") {
      if (v.trim().startsWith("{") || v.trim().startsWith("[")) {
        try {
          return walk(JSON.parse(v))
        } catch {}
      }
      return false
    }
    if (typeof v !== "object") return false
    if (seen.has(v)) return false
    seen.add(v)
    if (Array.isArray(v)) return v.some(walk)
    const o = v as Record<string, unknown>
    for (const k of Object.keys(o)) {
      const nk = k.normalize("NFKC")
      if (/^audience_id$/i.test(nk) || /^audienceId$/i.test(nk) || /^audience[-\s]?id$/i.test(nk)) return true
    }
    return Object.values(o).some(walk)
  }
  return walk(value)
}

function normalizeSearchBlob(blob: string): string {
  return blob
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
}

function blobContainsAudienceIdMarker(blob: string): boolean {
  const n = normalizeSearchBlob(blob)
  return (
    AUDIENCE_ID_LINE_RE.test(n) ||
    AUDIENCE_ID_TYPO_RE.test(n) ||
    AUDIENCE_ID_JSON_KEY_RE.test(n) ||
    AUDIENCE_ID_LOOSE_RE.test(n) ||
    AUDIENCE_ID_ES_RE.test(n)
  )
}

/** Full text blob for marker / UUID extraction (prompt, result, settings). */
export function collectNodeSearchBlob(node: InstanceNode): string {
  const chunks: string[] = []
  const promptText = (node.prompt as { text?: string } | undefined)?.text
  if (promptText) chunks.push(String(promptText))
  if (typeof node.result === "string") chunks.push(node.result)
  deepCollectStrings(node.result, chunks)
  try {
    chunks.push(JSON.stringify(node.result ?? {}))
  } catch {
    /* ignore */
  }
  try {
    chunks.push(JSON.stringify(node.settings ?? {}))
  } catch {
    /* ignore */
  }
  try {
    chunks.push(JSON.stringify(node.prompt ?? {}))
  } catch {
    /* ignore */
  }
  return chunks.join("\n")
}

const UUID_IN_TEXT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function extractAudienceUuidFromObject(value: unknown): string | null {
  const seen = new Set<unknown>()
  const walk = (v: unknown): string | null => {
    if (v == null) return null
    if (typeof v === "string") {
      if (v.trim().startsWith("{") || v.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(v)
          const nested = walk(parsed)
          if (nested) return nested
        } catch {}
      }
      return null
    }
    if (typeof v !== "object") return null
    if (seen.has(v)) return null
    seen.add(v)
    if (Array.isArray(v)) {
      for (const item of v) {
        const u = walk(item)
        if (u) return u
      }
      return null
    }
    const o = v as Record<string, unknown>
    for (const [k, val] of Object.entries(o)) {
      if (/^audience_id$/i.test(k) || /^audienceId$/i.test(k)) {
        if (typeof val === "string") {
          const m = val.match(UUID_IN_TEXT_RE)
          if (m) return m[0].toLowerCase()
        }
      }
    }
    for (const val of Object.values(o)) {
      if (val != null && typeof val === "object") {
        const u = walk(val)
        if (u) return u
      }
    }
    return null
  }
  return walk(value)
}

/**
 * Resolves segment / audience UUID from node output (maps to `leads.segment_id`).
 */
export function extractSegmentUuidFromAudienceBlob(blob: string): string | null {
  const n = normalizeSearchBlob(blob)
  let m = n.match(/(?:\\?["'])audience_id(?:\\?["'])\s*:\s*(?:\\?["'])([0-9a-f-]{36})(?:\\?["'])/i)
  if (m) return m[1].toLowerCase()
  m = n.match(/(?:\\?["'])audienceId(?:\\?["'])\s*:\s*(?:\\?["'])([0-9a-f-]{36})(?:\\?["'])/i)
  if (m) return m[1].toLowerCase()
  for (const line of n.split(/\n/)) {
    if (!/audience|audiencie|audiencia/i.test(line)) continue
    const um = line.match(UUID_IN_TEXT_RE)
    if (um) return um[0].toLowerCase()
  }
  m = n.match(/[`"']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[`"']/i)
  if (m) return m[1].toLowerCase()
  return null
}

/**
 * UUID for leads belonging to this audience: current node first, then ancestors up to Audience.
 */
function extractAudienceIdFromAudienceLeadsArray(node: InstanceNode, logs?: any[]): string | null {
  let leads = (node.result as any)?.audience_leads || (node.result as any)?.example_leads
  if (!leads && typeof node.result === 'object') {
    try {
      for (const val of Object.values(node.result as any)) {
        if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
          const parsed = JSON.parse(val);
          if (parsed && (parsed.audience_leads || parsed.example_leads)) {
            leads = parsed.audience_leads || parsed.example_leads;
            break;
          }
        }
      }
    } catch {}
  }
  
  if (!leads && logs && logs.length > 0) {
    const nodeLogs = logs.filter((l: any) => 
      l.command_id === node.id || 
      l.details?.instance_node_id === node.id ||
      l.details?.command_id === node.id
    )
    for (const log of nodeLogs) {
      if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
        if (log.tool_args?.audience_leads || log.tool_args?.example_leads) { leads = log.tool_args.audience_leads || log.tool_args.example_leads; break; }
        if (log.tool_result?.audience_leads || log.tool_result?.example_leads) { leads = log.tool_result.audience_leads || log.tool_result.example_leads; break; }
        if (log.details?.audience_leads || log.details?.example_leads) { leads = log.details.audience_leads || log.details.example_leads; break; }
      }
    }
    
    // Fallback: search ALL tool calls named 'audience' in the instance logs
    if (!leads) {
      const audienceLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result') && l.tool_name?.includes('audience')).reverse();
      for (const log of audienceLogs) {
        if (log.tool_args?.audience_leads || log.tool_args?.example_leads) { leads = log.tool_args.audience_leads || log.tool_args.example_leads; break; }
        if (log.tool_result?.audience_leads || log.tool_result?.example_leads) { leads = log.tool_result.audience_leads || log.tool_result.example_leads; break; }
        if (log.details?.audience_leads || log.details?.example_leads) { leads = log.details.audience_leads || log.details.example_leads; break; }
      }
    }

    // Fallback 3: Check nested in `tool_result.output.result` for Agent `tools` wrapper
    if (!leads) {
      const allToolLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result')).reverse();
      for (const log of allToolLogs) {
        const nestedResult = log.tool_result?.output?.result;
        if (nestedResult?.audience_leads || nestedResult?.example_leads) {
          leads = nestedResult.audience_leads || nestedResult.example_leads;
          break;
        }
      }
    }
  }
  
  if (!Array.isArray(leads) || leads.length === 0) {
// #region agent log
// #endregion
    return null
  }
  const aid = leads[0]?.audience_id
// #region agent log
// #endregion
  if (typeof aid === "string" && UUID_IN_TEXT_RE.test(aid)) return aid.toLowerCase()
  return null
}

export function resolveAudienceSegmentIdForImprenta(node: InstanceNode, nodes: InstanceNode[], logs?: any[]): string | null {
// #region agent log
// #endregion
  let id =
    extractAudienceIdFromAudienceLeadsArray(node, logs) ||
    extractAudienceUuidFromObject(node.result) ||
    extractAudienceUuidFromObject(node.settings) ||
    extractAudienceUuidFromObject(node.prompt) ||
    extractSegmentUuidFromAudienceBlob(collectNodeSearchBlob(node))
  if (id) return id
  
  // Search in logs if provided
  if (logs && logs.length > 0) {
    const nodeLogs = logs.filter(l => 
      l.command_id === node.id || 
      l.details?.instance_node_id === node.id ||
      l.details?.command_id === node.id
    )
    for (const log of nodeLogs) {
      if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
        const logId = extractAudienceUuidFromObject(log.tool_args) || extractAudienceUuidFromObject(log.tool_result) || extractAudienceUuidFromObject(log.details)
        if (logId) return logId
      }
      if (log.message) {
        const mId = extractSegmentUuidFromAudienceBlob(log.message)
        if (mId) return mId
      }
    }
    
    // Fallback: search ALL tool calls named 'audience' in the instance logs
    const audienceLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result') && l.tool_name?.includes('audience')).reverse();
    for (const log of audienceLogs) {
      const logId = extractAudienceUuidFromObject(log.tool_args) || extractAudienceUuidFromObject(log.tool_result) || extractAudienceUuidFromObject(log.details);
      if (logId) return logId;
    }

    // Fallback 3: Check nested in `tool_result.output.result` for Agent `tools` wrapper
    const allToolLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result')).reverse();
    for (const log of allToolLogs) {
      const nestedResult = log.tool_result?.output?.result;
      const nestedId = extractAudienceUuidFromObject(nestedResult);
      if (nestedId) return nestedId;
      if (nestedResult?.audience_leads || nestedResult?.example_leads) return log.id;
    }
  }

  if (isValidPublishAudienceSource(node) || (node.settings as any)?.media_type === "audience") {
    return node.id
  }

  if (!isDescendantOfAudienceNode(node, nodes)) return null
  let pid: string | null = node.parent_node_id
  const seen = new Set<string>()
  while (pid && !seen.has(pid)) {
    seen.add(pid)
    const p = nodes.find((x) => x.id === pid)
    if (!p) break
    id =
      extractAudienceIdFromAudienceLeadsArray(p, logs) ||
      extractAudienceUuidFromObject(p.result) ||
      extractAudienceUuidFromObject(p.settings) ||
      extractAudienceUuidFromObject(p.prompt) ||
      extractSegmentUuidFromAudienceBlob(collectNodeSearchBlob(p))
    if (id) return id
    
    // Search in logs for parent
    if (logs && logs.length > 0) {
      const parentLogs = logs.filter(l => 
        l.command_id === p.id || 
        l.details?.instance_node_id === p.id ||
        l.details?.command_id === p.id
      )
      for (const log of parentLogs) {
        if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
          const logId = extractAudienceUuidFromObject(log.tool_args) || extractAudienceUuidFromObject(log.tool_result) || extractAudienceUuidFromObject(log.details)
          if (logId) return logId
        }
        if (log.message) {
          const mId = extractSegmentUuidFromAudienceBlob(log.message)
          if (mId) return mId
        }
        
        // Also check if the message itself is a stringified JSON containing audience_id
        if (log.message && (log.message.trim().startsWith('{') || log.message.trim().startsWith('['))) {
          try {
            const parsed = JSON.parse(log.message);
            const mId = extractAudienceUuidFromObject(parsed);
            if (mId) return mId;
          } catch {}
        }
      }
      
      // Fallback: search ALL tool calls named 'audience' in the instance logs
      const audienceLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result') && l.tool_name?.includes('audience')).reverse();
      for (const log of audienceLogs) {
        const logId = extractAudienceUuidFromObject(log.tool_args) || extractAudienceUuidFromObject(log.tool_result) || extractAudienceUuidFromObject(log.details);
        if (logId) return logId;
      }

      // Fallback 2: Any tool call that has audience_leads or example_leads inside it
      const allToolLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result')).reverse();
      for (const log of allToolLogs) {
        const logId = extractAudienceUuidFromObject(log.tool_args) || extractAudienceUuidFromObject(log.tool_result) || extractAudienceUuidFromObject(log.details);
        if (logId) return logId;
        if (log.tool_args?.audience_leads || log.tool_result?.audience_leads || log.details?.audience_leads || log.tool_args?.example_leads || log.tool_result?.example_leads || log.details?.example_leads) {
          return log.id; // Return the log ID if no audience_id is found, as a fallback ID for the carousel
        }
      }
    }
    
    if (isValidPublishAudienceSource(p) || (p.settings as any)?.media_type === "audience") return p.id
    pid = p.parent_node_id
  }
  return null
}

export function nodeContainsAudienceIdMarker(node: InstanceNode, logs?: any[]): boolean {
  if (objectGraphHasAudienceIdKey(node.result)) return true
  if (objectGraphHasAudienceIdKey(node.settings)) return true
  if (objectGraphHasAudienceIdKey(node.prompt)) return true

  const haystack = collectNodeSearchBlob(node)
  if (blobContainsAudienceIdMarker(haystack)) return true
  
  if (logs && logs.length > 0) {
    const nodeLogs = logs.filter(l => 
      l.command_id === node.id || 
      l.details?.instance_node_id === node.id ||
      l.details?.command_id === node.id
    )
    for (const log of nodeLogs) {
      if (objectGraphHasAudienceIdKey(log.tool_args) || objectGraphHasAudienceIdKey(log.tool_result) || objectGraphHasAudienceIdKey(log.details)) return true;
      if (log.message && blobContainsAudienceIdMarker(log.message)) return true;
      if (log.message && (log.message.trim().startsWith('{') || log.message.trim().startsWith('['))) {
        try {
          if (objectGraphHasAudienceIdKey(JSON.parse(log.message))) return true;
        } catch {}
      }
    }
  }

  return false
}

function audienceNodeHasNonemptyResult(node: InstanceNode): boolean {
  const r = node.result
  if (r == null) return false
  if (typeof r === "string") return r.trim().length > 0
  if (typeof r === "object" && !Array.isArray(r)) return Object.keys(r).length > 0
  if (Array.isArray(r)) return r.length > 0
  return false
}

/**
 * Audience wire: child of an Audience node, or explicit audience_id / non-empty result on an Audience node.
 */
export function isPublishAudienceSourceReady(node: InstanceNode, nodes: InstanceNode[], logs?: any[]): boolean {
  if (isDescendantOfAudienceNode(node, nodes)) return true
  if (isValidPublishAudienceSource(node) && audienceNodeHasNonemptyResult(node)) return true
  
  if (nodeContainsAudienceIdMarker(node, logs)) return true
  
  const parentNode = nodes.find(n => n.id === node.parent_node_id);
  if (parentNode && isValidPublishAudienceSource(parentNode) && audienceNodeHasNonemptyResult(node)) return true;
  
  return false
}

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

type ContextRow = {
  target_node_id: string
  context_node_id: string
  type?: string | null
}

export function hasPublishContentInput(
  contexts: ContextRow[],
  publishNodeId: string,
  nodes: InstanceNode[]
): boolean {
  return contexts.some((c) => {
    if (c.target_node_id !== publishNodeId || c.type !== PUBLISH_SLOT_CONTENT) return false
    const src = nodes.find((n) => n.id === c.context_node_id)
    return !!(src && isValidPublishContentOrContextSource(src, nodes))
  })
}

export function hasPublishAudienceInput(
  contexts: ContextRow[],
  publishNodeId: string,
  nodes: InstanceNode[],
  logs?: any[]
): boolean {
  return contexts.some((c) => {
    if (c.target_node_id !== publishNodeId || c.type !== PUBLISH_SLOT_AUDIENCE) return false
    const src = nodes.find((n) => n.id === c.context_node_id)
    return !!(src && isPublishAudienceSourceReady(src, nodes, logs))
  })
}

export function validatePublishNodeInputs(
  node: InstanceNode,
  contexts: ContextRow[],
  nodes: InstanceNode[],
  logs?: any[]
): string | null {
  if (node.type !== "publish") return null
  if (!hasPublishContentInput(contexts, node.id, nodes)) {
    return "Connect Content from any non-Audience source (same allowed types as Context)."
  }
  const dest = Array.isArray((node.settings as any)?.publish_destinations)
    ? ((node.settings as any).publish_destinations as string[])
    : []
  if (destinationsRequireAudience(dest) && !hasPublishAudienceInput(contexts, node.id, nodes, logs)) {
    return "Mail, WhatsApp, Telegram, Audio, Voice, SMS, Message, Email, and Newsletter require an Audience link: from an Audience node or a node whose parent is Audience."
  }
  return null
}
