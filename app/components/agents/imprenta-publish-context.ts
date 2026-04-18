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
  return dest.some((d) => d === "mail" || d === "whatsapp" || d === "newsletter")
}

/** Accept hyphen or underscore (DB / clients may differ). */
export function isValidPublishAudienceSource(node: InstanceNode): boolean {
  const t = (node.type || "").trim().toLowerCase().replace(/_/g, "-")
  return t === "generate-audience"
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
  /["'`]?audience_id["'`]?\s*:|["'`]?audienceId["'`]?\s*:/i
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
    if (v == null || typeof v !== "object") return false
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
  if (value == null || typeof value !== "object") return null
  const seen = new Set<unknown>()
  const walk = (v: unknown): string | null => {
    if (v == null || typeof v !== "object") return null
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
  let m = n.match(/["']audience_id["']\s*:\s*["']([0-9a-f-]{36})["']/i)
  if (m) return m[1].toLowerCase()
  m = n.match(/["']audienceId["']\s*:\s*["']([0-9a-f-]{36})["']/i)
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
function extractAudienceIdFromAudienceLeadsArray(node: InstanceNode): string | null {
  const leads = (node.result as { audience_leads?: { audience_id?: string }[] } | undefined)?.audience_leads
  if (!Array.isArray(leads) || leads.length === 0) return null
  const aid = leads[0]?.audience_id
  if (typeof aid === "string" && UUID_IN_TEXT_RE.test(aid)) return aid.toLowerCase()
  return null
}

export function resolveAudienceSegmentIdForImprenta(node: InstanceNode, nodes: InstanceNode[]): string | null {
  let id =
    extractAudienceIdFromAudienceLeadsArray(node) ||
    extractAudienceUuidFromObject(node.result) ||
    extractAudienceUuidFromObject(node.settings) ||
    extractAudienceUuidFromObject(node.prompt) ||
    extractSegmentUuidFromAudienceBlob(collectNodeSearchBlob(node))
  if (id) return id
  if (!isDescendantOfAudienceNode(node, nodes)) return null
  let pid: string | null = node.parent_node_id
  const seen = new Set<string>()
  while (pid && !seen.has(pid)) {
    seen.add(pid)
    const p = nodes.find((x) => x.id === pid)
    if (!p) break
    id =
      extractAudienceIdFromAudienceLeadsArray(p) ||
      extractAudienceUuidFromObject(p.result) ||
      extractSegmentUuidFromAudienceBlob(collectNodeSearchBlob(p))
    if (id) return id
    pid = p.parent_node_id
  }
  return null
}

export function nodeContainsAudienceIdMarker(node: InstanceNode): boolean {
  if (objectGraphHasAudienceIdKey(node.result)) return true
  if (objectGraphHasAudienceIdKey(node.settings)) return true
  if (objectGraphHasAudienceIdKey(node.prompt)) return true

  const haystack = collectNodeSearchBlob(node)
  return blobContainsAudienceIdMarker(haystack)
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
export function isPublishAudienceSourceReady(node: InstanceNode, nodes: InstanceNode[]): boolean {
  if (isDescendantOfAudienceNode(node, nodes)) return true
  if (!isValidPublishAudienceSource(node)) return false
  if (nodeContainsAudienceIdMarker(node)) return true
  return audienceNodeHasNonemptyResult(node)
}

/** Types that attach to the middle “Context” anchor on Publish (normal relations). */
export function isNormalPublishContextType(t: string | null | undefined): boolean {
  if (t === PUBLISH_SLOT_CONTENT || t === PUBLISH_SLOT_AUDIENCE) return false
  return (
    t == null ||
    t === PUBLISH_SLOT_REFERENCE ||
    t === "context" ||
    t === "style" ||
    t === "negative" ||
    t === "data" ||
    t === "from" ||
    t === "to"
  )
}

/** Label for the floating badge on wires into a Publish node. */
export function getPublishContextEdgeCaption(
  targetNodeType: string | undefined,
  connectionType: string | null | undefined
): string {
  if (targetNodeType !== "publish") return String(connectionType || "reference")
  if (connectionType === PUBLISH_SLOT_CONTENT) return PUBLISH_ANCHOR_LABELS.content
  if (connectionType === PUBLISH_SLOT_AUDIENCE) return PUBLISH_ANCHOR_LABELS.audience
  if (isNormalPublishContextType(connectionType)) return PUBLISH_ANCHOR_LABELS.context
  return String(connectionType || PUBLISH_ANCHOR_LABELS.context)
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
  nodes: InstanceNode[]
): boolean {
  return contexts.some((c) => {
    if (c.target_node_id !== publishNodeId || c.type !== PUBLISH_SLOT_AUDIENCE) return false
    const src = nodes.find((n) => n.id === c.context_node_id)
    return !!(src && isPublishAudienceSourceReady(src, nodes))
  })
}

export function validatePublishNodeInputs(
  node: InstanceNode,
  contexts: ContextRow[],
  nodes: InstanceNode[]
): string | null {
  if (node.type !== "publish") return null
  if (!hasPublishContentInput(contexts, node.id, nodes)) {
    return "Connect Content from any non-Audience source (same allowed types as Context)."
  }
  const dest = Array.isArray((node.settings as any)?.publish_destinations)
    ? ((node.settings as any).publish_destinations as string[])
    : []
  if (destinationsRequireAudience(dest) && !hasPublishAudienceInput(contexts, node.id, nodes)) {
    return "Mail, WhatsApp, and Newsletter require an Audience link: from an Audience node or a node whose parent is Audience."
  }
  return null
}
