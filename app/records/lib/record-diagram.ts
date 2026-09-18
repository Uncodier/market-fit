import { z } from "zod"

export const RECORD_DIAGRAM_SCHEMA = "record-diagram.v1" as const

export const RECORD_NODE_KINDS = [
  "title",
  "description",
  "note",
  "concept",
  "question",
  "decision",
  "source",
  "process",
  "data",
  "database",
  "terminator",
] as const

export const RECORD_EDGE_TYPES = [
  "relates_to",
  "supports",
  "contradicts",
  "causes",
  "contains",
  "references",
] as const

export const RECORD_NODE_PORTS = ["top", "right", "bottom", "left"] as const

export const RECORD_NODE_COLORS = [
  "neutral",
  "blue",
  "green",
  "amber",
  "rose",
  "violet",
] as const

export const RECORD_NODE_SHAPES = ["rounded", "soft", "square"] as const
export const RECORD_NODE_BORDER_WIDTHS = ["thin", "medium", "thick"] as const
export const RECORD_DIAGRAM_BACKGROUNDS = ["dots", "grid", "columns", "rows", "plain"] as const

export const recordNodeAttachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  url: z.string().url().max(2048),
  mimeType: z.string().max(200),
  size: z.number().int().nonnegative().max(25 * 1024 * 1024),
  kind: z.enum(["image", "file"]),
})

export const recordNodeMetadataSchema = z.object({
  visual: z.object({
    color: z.enum(RECORD_NODE_COLORS).default("neutral"),
    shape: z.enum(RECORD_NODE_SHAPES).default("rounded"),
    borderColor: z.enum(RECORD_NODE_COLORS).optional(),
    borderWidth: z.enum(RECORD_NODE_BORDER_WIDTHS).optional(),
  }).optional(),
  attachments: z.array(recordNodeAttachmentSchema).max(8).optional(),
}).catchall(z.unknown())

export const recordDiagramViewportSchema = z.object({
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  zoom: z.number().finite().positive().max(4).default(1),
  background: z.enum(RECORD_DIAGRAM_BACKGROUNDS).optional(),
})

export const recordDiagramNodeSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(RECORD_NODE_KINDS).default("note"),
  title: z.string().trim().min(1).max(240),
  content: z.string().max(12_000).default(""),
  metadata: recordNodeMetadataSchema.default({}),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
})

export const recordDiagramEdgeSchema = z.object({
  id: z.string().uuid(),
  source: z.string().uuid(),
  target: z.string().uuid(),
  type: z.enum(RECORD_EDGE_TYPES).default("relates_to"),
  label: z.string().trim().max(120).optional(),
  metadata: z.object({
    sourcePort: z.enum(RECORD_NODE_PORTS).optional(),
    targetPort: z.enum(RECORD_NODE_PORTS).optional(),
    bidirectional: z.boolean().optional(),
  }).catchall(z.unknown()).default({}),
})

export const recordDiagramDraftSchema = z.object({
  revision: z.number().int().nonnegative().default(0),
  viewport: recordDiagramViewportSchema.default({ x: 0, y: 0, zoom: 1 }),
  nodes: z.array(recordDiagramNodeSchema).max(200),
  edges: z.array(recordDiagramEdgeSchema).max(500),
}).superRefine((diagram, ctx) => {
  const nodeIds = new Set<string>()
  for (const [index, node] of diagram.nodes.entries()) {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", index, "id"],
        message: "Node IDs must be unique",
      })
    }
    nodeIds.add(node.id)
  }

  const edgeIds = new Set<string>()
  for (const [index, edge] of diagram.edges.entries()) {
    if (edgeIds.has(edge.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index, "id"],
        message: "Edge IDs must be unique",
      })
    }
    edgeIds.add(edge.id)

    if (edge.source === edge.target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index],
        message: "An edge cannot connect a node to itself",
      })
    }
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index],
        message: "Edge endpoints must exist in the diagram",
      })
    }
  }
})

export type RecordDiagramViewport = z.infer<typeof recordDiagramViewportSchema>
export type RecordDiagramBackground = typeof RECORD_DIAGRAM_BACKGROUNDS[number]
export type RecordDiagramNode = z.infer<typeof recordDiagramNodeSchema>
export type RecordDiagramEdge = z.infer<typeof recordDiagramEdgeSchema>
export type RecordDiagramDraft = z.infer<typeof recordDiagramDraftSchema>
export type RecordNodeKind = RecordDiagramNode["kind"]
export type RecordEdgeType = RecordDiagramEdge["type"]
export type RecordNodePort = typeof RECORD_NODE_PORTS[number]
export type RecordNodeColor = typeof RECORD_NODE_COLORS[number]
export type RecordNodeShape = typeof RECORD_NODE_SHAPES[number]
export type RecordNodeBorderWidth = typeof RECORD_NODE_BORDER_WIDTHS[number]
export type RecordNodeAttachment = z.infer<typeof recordNodeAttachmentSchema>

export type RecordDiagramContext = {
  schema: typeof RECORD_DIAGRAM_SCHEMA
  record: {
    id: string
    title: string
    category?: string | null
  }
  nodes: Array<Omit<RecordDiagramNode, "position">>
  edges: Array<RecordDiagramEdge>
}

export function emptyRecordDiagram(): RecordDiagramDraft {
  return {
    revision: 0,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  }
}

export function formatRecordNodeKind(kind: RecordNodeKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function formatRecordEdgeType(type: RecordEdgeType): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableObject(nested)])
  )
}

export function areRecordDiagramDraftsEqual(
  left: RecordDiagramDraft,
  right: RecordDiagramDraft,
): boolean {
  const semanticDraft = (draft: RecordDiagramDraft) => stableObject({
    viewport: draft.viewport,
    nodes: draft.nodes,
    edges: draft.edges,
  })
  return JSON.stringify(semanticDraft(left)) === JSON.stringify(semanticDraft(right))
}

export function buildNodeEmbeddingText(input: {
  recordTitle: string
  categoryName?: string | null
  node: Pick<RecordDiagramNode, "kind" | "title" | "content" | "metadata">
}): string {
  const attachments = input.node.metadata.attachments || []
  return [
    `Record: ${input.recordTitle.trim()}`,
    input.categoryName ? `Category: ${input.categoryName.trim()}` : "",
    `Node type: ${formatRecordNodeKind(input.node.kind)}`,
    `Title: ${input.node.title.trim()}`,
    input.node.content.trim() ? `Content:\n${input.node.content.trim()}` : "",
    attachments.length
      ? `Attachments: ${attachments.map((attachment) =>
          `${attachment.name} (${attachment.mimeType || attachment.kind})`
        ).join(", ")}`
      : "",
  ].filter(Boolean).join("\n")
}

export function serializeRecordDiagramForAgent(input: {
  record: { id: string; title: string; category?: string | null }
  diagram: Pick<RecordDiagramDraft, "nodes" | "edges">
  maxNodes?: number
}): RecordDiagramContext {
  const maxNodes = Math.max(1, Math.min(input.maxNodes ?? 100, 200))
  const nodes = [...input.diagram.nodes]
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, maxNodes)
    .map(({ position: _position, ...node }) => stableObject(node) as Omit<RecordDiagramNode, "position">)
  const includedIds = new Set(nodes.map((node) => node.id))
  const edges = [...input.diagram.edges]
    .filter((edge) => includedIds.has(edge.source) && includedIds.has(edge.target))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((edge) => stableObject(edge) as RecordDiagramEdge)

  return {
    schema: RECORD_DIAGRAM_SCHEMA,
    record: {
      id: input.record.id,
      title: input.record.title,
      category: input.record.category ?? null,
    },
    nodes,
    edges,
  }
}

export function serializeRecordDiagramSemanticText(context: RecordDiagramContext): string {
  const nodeLines = context.nodes.map((node) =>
    [
      `[${node.kind}] ${node.title}`,
      node.content.trim(),
    ].filter(Boolean).join("\n")
  )
  const nodeById = new Map(context.nodes.map((node) => [node.id, node]))
  const edgeLines = context.edges.map((edge) => {
    const source = nodeById.get(edge.source)?.title || edge.source
    const target = nodeById.get(edge.target)?.title || edge.target
    return `${source} --${edge.type}${edge.label ? ` (${edge.label})` : ""}--> ${target}`
  })

  return [
    `Record: ${context.record.title}`,
    context.record.category ? `Category: ${context.record.category}` : "",
    nodeLines.length ? `Nodes:\n${nodeLines.join("\n\n")}` : "",
    edgeLines.length ? `Relations:\n${edgeLines.join("\n")}` : "",
  ].filter(Boolean).join("\n\n")
}

export function boundRecordDiagramContext(
  context: RecordDiagramContext,
  options: {
    maxNodes?: number
    maxEdges?: number
    maxContentLength?: number
  } = {}
): RecordDiagramContext {
  const maxNodes = Math.max(1, Math.min(options.maxNodes ?? 25, 100))
  const maxEdges = Math.max(0, Math.min(options.maxEdges ?? 50, 200))
  const maxContentLength = Math.max(100, Math.min(options.maxContentLength ?? 1500, 4000))
  const nodes = [...(context.nodes || [])]
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, maxNodes)
    .map((node) => ({
      ...node,
      content: node.content.slice(0, maxContentLength),
      metadata: boundMetadata(node.metadata),
    }))
  const includedNodeIds = new Set(nodes.map((node) => node.id))
  const edges = [...(context.edges || [])]
    .filter((edge) =>
      includedNodeIds.has(edge.source)
      && includedNodeIds.has(edge.target)
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, maxEdges)
    .map((edge) => ({
      ...edge,
      metadata: boundMetadata(edge.metadata),
    }))

  return { ...context, nodes, edges }
}

function boundMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const entries: [string, unknown][] = []
  for (const [key, value] of Object.entries(metadata || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 20)) {
    if (value == null || typeof value === "boolean" || typeof value === "number") {
      entries.push([key, value])
    } else if (typeof value === "string") {
      entries.push([key, value.slice(0, 500)])
    } else if (key === "visual" && typeof value === "object") {
      const visual = value as Record<string, unknown>
      entries.push([key, {
        color: typeof visual.color === "string" ? visual.color.slice(0, 32) : "neutral",
        shape: typeof visual.shape === "string" ? visual.shape.slice(0, 32) : "rounded",
      }])
    } else if (key === "attachments" && Array.isArray(value)) {
      entries.push([key, value.slice(0, 8).flatMap((attachment) => {
        if (!attachment || typeof attachment !== "object") return []
        const item = attachment as Record<string, unknown>
        return [{
          id: String(item.id || "").slice(0, 64),
          name: String(item.name || "").slice(0, 240),
          url: String(item.url || "").slice(0, 2048),
          mimeType: String(item.mimeType || "").slice(0, 200),
          size: typeof item.size === "number" ? item.size : 0,
          kind: item.kind === "image" ? "image" : "file",
        }]
      })])
    }
  }
  return Object.fromEntries(entries)
}
