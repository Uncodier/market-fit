import type {
  RecordDiagramEdge,
  RecordDiagramNode,
  RecordNodeAttachment,
} from "@/app/records/lib/record-diagram"
import { placeRecordDiagramNode } from "./record-diagram-layout"

export function createRecordDiagramNode(
  nodes: RecordDiagramNode[],
  parent: RecordDiagramNode | null,
) {
  const node: RecordDiagramNode = {
    id: crypto.randomUUID(),
    kind: "note",
    title: "New node",
    content: "",
    metadata: {},
    position: placeRecordDiagramNode(nodes, parent),
  }
  return { node, edge: createParentEdge(parent, node, "relates_to") }
}

export function createAttachmentDiagramNode(
  nodes: RecordDiagramNode[],
  parent: RecordDiagramNode | null,
  attachment: RecordNodeAttachment,
) {
  const node: RecordDiagramNode = {
    id: crypto.randomUUID(),
    kind: "source",
    title: attachment.name,
    content: "",
    metadata: {
      attachments: [attachment],
      visual: {
        color: attachment.kind === "image" ? "violet" : "blue",
        shape: "rounded",
        borderWidth: "medium",
      },
    },
    position: placeRecordDiagramNode(nodes, parent),
  }
  return { node, edge: createParentEdge(parent, node, "references") }
}

function createParentEdge(
  parent: RecordDiagramNode | null,
  node: RecordDiagramNode,
  type: RecordDiagramEdge["type"],
): RecordDiagramEdge | null {
  return parent ? {
    id: crypto.randomUUID(),
    source: parent.id,
    target: node.id,
    type,
    metadata: { sourcePort: "right", targetPort: "left" },
  } : null
}
