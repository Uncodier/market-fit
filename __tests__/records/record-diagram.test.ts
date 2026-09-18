import {
  RECORD_DIAGRAM_SCHEMA,
  boundRecordDiagramContext,
  buildNodeEmbeddingText,
  recordDiagramDraftSchema,
  serializeRecordDiagramForAgent,
  serializeRecordDiagramSemanticText,
  type RecordDiagramDraft,
} from "@/app/records/lib/record-diagram"

const nodeA = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "concept" as const,
  title: "Market signal",
  content: "Customers repeatedly ask for export.",
  metadata: { priority: 1 },
  position: { x: 700, y: 200 },
}
const nodeB = {
  id: "00000000-0000-4000-8000-000000000002",
  kind: "decision" as const,
  title: "Build export",
  content: "Ship a CSV export first.",
  metadata: {},
  position: { x: 40, y: 90 },
}

function diagram(): RecordDiagramDraft {
  return {
    revision: 2,
    viewport: { x: 20, y: 30, zoom: 1.2 },
    nodes: [nodeB, nodeA],
    edges: [{
      id: "00000000-0000-4000-8000-000000000003",
      source: nodeA.id,
      target: nodeB.id,
      type: "supports",
      label: "Evidence",
      metadata: {},
    }],
  }
}

describe("record diagram schema", () => {
  it("accepts a valid semantic graph", () => {
    expect(recordDiagramDraftSchema.parse(diagram())).toEqual(diagram())
  })

  it("rejects dangling edges and self-links", () => {
    const dangling = {
      ...diagram(),
      edges: [{
        ...diagram().edges[0],
        target: "00000000-0000-4000-8000-000000000099",
      }],
    }
    expect(() => recordDiagramDraftSchema.parse(dangling)).toThrow("Edge endpoints must exist")

    const selfLink = {
      ...diagram(),
      edges: [{ ...diagram().edges[0], target: nodeA.id }],
    }
    expect(() => recordDiagramDraftSchema.parse(selfLink)).toThrow(
      "An edge cannot connect a node to itself"
    )
  })

  it("rejects duplicate IDs and oversized payloads", () => {
    expect(() => recordDiagramDraftSchema.parse({
      ...diagram(),
      nodes: [nodeA, nodeA],
      edges: [],
    })).toThrow("Node IDs must be unique")

    expect(() => recordDiagramDraftSchema.parse({
      ...diagram(),
      nodes: Array.from({ length: 201 }, (_, index) => ({
        ...nodeA,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      })),
      edges: [],
    })).toThrow()
  })

  it("validates structured visual options and attachments", () => {
    const attachment = {
      id: "00000000-0000-4000-8000-000000000004",
      name: "research.pdf",
      url: "https://example.com/research.pdf",
      mimeType: "application/pdf",
      size: 1024,
      kind: "file" as const,
    }
    const parsed = recordDiagramDraftSchema.parse({
      ...diagram(),
      nodes: [{
        ...nodeA,
        metadata: {
          visual: {
            color: "blue",
            shape: "soft",
            borderColor: "rose",
            borderWidth: "thick",
          },
          attachments: [attachment],
        },
      }, nodeB],
    })

    expect(parsed.nodes[0].metadata.attachments).toEqual([attachment])
    expect(parsed.nodes[0].metadata.visual?.borderColor).toBe("rose")
    expect(parsed.nodes[0].metadata.visual?.borderWidth).toBe("thick")
    expect(buildNodeEmbeddingText({
      recordTitle: "Discovery",
      node: parsed.nodes[0],
    })).toContain("research.pdf (application/pdf)")
  })

  it.each(["title", "description", "process", "data", "database", "terminator"] as const)(
    "accepts the %s diagram node type",
    (kind) => {
      expect(recordDiagramDraftSchema.parse({
        ...diagram(),
        nodes: [{ ...nodeA, kind }, nodeB],
      }).nodes[0].kind).toBe(kind)
    }
  )
})

describe("record diagram agent serialization", () => {
  it("is deterministic and excludes visual state", () => {
    const first = serializeRecordDiagramForAgent({
      record: { id: "record-1", title: "Discovery", category: "Research" },
      diagram: diagram(),
    })
    const visuallyChangedDiagram: RecordDiagramDraft = {
      ...diagram(),
      viewport: { x: 999, y: -200, zoom: 2 },
      nodes: [nodeA, nodeB].map((node) => ({
        ...node,
        position: { x: node.position.x + 500, y: node.position.y + 500 },
      })),
    }
    const second = serializeRecordDiagramForAgent({
      record: { id: "record-1", title: "Discovery", category: "Research" },
      diagram: visuallyChangedDiagram,
    })

    expect(first).toEqual(second)
    expect(first.schema).toBe(RECORD_DIAGRAM_SCHEMA)
    expect(first.nodes.map((node) => node.id)).toEqual([nodeA.id, nodeB.id])
    expect(JSON.stringify(first)).not.toContain("position")
    expect(JSON.stringify(first)).not.toContain("viewport")
  })

  it("builds stable, semantic embedding input without IDs or coordinates", () => {
    const input = buildNodeEmbeddingText({
      recordTitle: "Discovery",
      categoryName: "Research",
      node: nodeA,
    })
    expect(input).toContain("Record: Discovery")
    expect(input).toContain("Node type: Concept")
    expect(input).toContain(nodeA.content)
    expect(input).not.toContain(nodeA.id)
    expect(input).not.toContain("700")
  })

  it("serializes readable aggregate graph text", () => {
    const context = serializeRecordDiagramForAgent({
      record: { id: "record-1", title: "Discovery" },
      diagram: diagram(),
    })
    const text = serializeRecordDiagramSemanticText(context)
    expect(text).toContain("Market signal --supports (Evidence)--> Build export")
  })

  it("bounds record context content and metadata", () => {
    const context = serializeRecordDiagramForAgent({
      record: { id: "record-1", title: "Discovery" },
      diagram: diagram(),
    })
    const bounded = boundRecordDiagramContext({
      ...context,
      nodes: Array.from({ length: 30 }, (_, index) => ({
        ...context.nodes[0],
        id: `node-${String(index).padStart(2, "0")}`,
        content: "x".repeat(5000),
        metadata: Object.fromEntries(
          Array.from({ length: 30 }, (__, metadataIndex) => [`key-${metadataIndex}`, "value"])
        ),
      })),
      edges: [],
    })

    expect(bounded.nodes).toHaveLength(25)
    expect(bounded.nodes[0].content).toHaveLength(1500)
    expect(Object.keys(bounded.nodes[0].metadata)).toHaveLength(20)
  })

  it("preserves bounded attachment semantics for agent context", () => {
    const context = serializeRecordDiagramForAgent({
      record: { id: "record-1", title: "Discovery" },
      diagram: {
        ...diagram(),
        nodes: [{
          ...nodeA,
          metadata: {
            visual: { color: "green", shape: "rounded" },
            attachments: [{
              id: "00000000-0000-4000-8000-000000000004",
              name: "signal.png",
              url: "https://example.com/signal.png",
              mimeType: "image/png",
              size: 2048,
              kind: "image",
            }],
          },
        }, nodeB],
      },
    })
    const bounded = boundRecordDiagramContext(context)

    expect(bounded.nodes[0].metadata).toEqual({
      attachments: [{
        id: "00000000-0000-4000-8000-000000000004",
        name: "signal.png",
        url: "https://example.com/signal.png",
        mimeType: "image/png",
        size: 2048,
        kind: "image",
      }],
      visual: { color: "green", shape: "rounded" },
    })
  })
})
