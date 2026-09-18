import type {
  RecordDiagramEdge,
  RecordDiagramNode,
  RecordNodePort,
} from "@/app/records/lib/record-diagram"

export const RECORD_NODE_WIDTH = 480
export const RECORD_NODE_HEIGHT = 300
export const RECORD_NODE_HORIZONTAL_GAP = 80
export const RECORD_NODE_VERTICAL_GAP = 40

export type DiagramPoint = { x: number; y: number }
export type DiagramSize = { width: number; height: number }
export type RecordDiagramLayout = "hierarchy" | "columns" | "rows" | "grid"

export function getRecordDiagramNodeSize(node: RecordDiagramNode): DiagramSize {
  const attachmentsHeight = node.metadata.attachments?.length ? 72 : 0
  if (node.kind === "title") {
    return {
      width: clampSize(180 + node.title.length * 11, 240, 720),
      height: 64,
    }
  }

  const lines = node.content.split("\n")
  const longestLine = Math.max(1, ...lines.map((line) => line.length))
  const horizontalPadding = ["decision", "question", "data"].includes(node.kind) ? 150 : 64
  const titleWidth = node.kind === "description" ? 0 : node.title.length * 9 + horizontalPadding
  let width = clampSize(
    Math.max(titleWidth, longestLine * 7.5 + horizontalPadding),
    300,
    560,
  )
  const charactersPerLine = Math.max(20, Math.floor((width - horizontalPadding) / 7.5))
  const wrappedLines = lines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
    0,
  )
  const titleHeight = node.kind === "description" ? 0 : 40
  const verticalPadding = getRecordNodeVerticalPadding(node.kind)
  const minimumHeight = {
    description: 64,
    question: 132,
    decision: 176,
    source: 120,
    database: 132,
    terminator: 112,
  }[node.kind] || 112
  let height = clampSize(
    verticalPadding + titleHeight + wrappedLines * 20 + attachmentsHeight,
    minimumHeight,
    440,
  )

  if (node.kind === "decision") {
    height = Math.max(height, 176)
    width = Math.max(width, Math.min(640, height * 1.65))
  } else if (node.kind === "question") {
    height = Math.max(height, 132)
    width = Math.max(width, Math.min(600, height * 1.7))
  } else if (node.kind === "database") {
    height = Math.max(height, 132)
  } else if (node.kind === "terminator") {
    height = Math.max(height, 112)
    width = Math.max(width, Math.min(600, height * 1.8))
  }
  return { width, height }
}

export function getRecordDiagramNodeTextHeight(node: RecordDiagramNode) {
  if (node.kind === "title") return 0
  const size = getRecordDiagramNodeSize(node)
  const horizontalPadding = ["decision", "question", "data"].includes(node.kind) ? 150 : 64
  const charactersPerLine = Math.max(20, Math.floor((size.width - horizontalPadding) / 7.5))
  const wrappedLines = node.content.split("\n").reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
    0,
  )
  const titleSpace = node.kind === "description" ? 0 : 40
  const attachmentSpace = node.metadata.attachments?.length ? 72 : 0
  const availableHeight = Math.max(
    20,
    size.height - titleSpace - attachmentSpace - getRecordNodeVerticalPadding(node.kind),
  )
  return Math.min(wrappedLines * 20, availableHeight)
}

function getRecordNodeVerticalPadding(kind: RecordDiagramNode["kind"]) {
  return {
    title: 0,
    description: 16,
    note: 40,
    concept: 40,
    question: 48,
    decision: 80,
    source: 36,
    process: 40,
    data: 40,
    database: 48,
    terminator: 40,
  }[kind]
}

export function getRecordNodePortPoint(
  node: RecordDiagramNode,
  port: RecordNodePort
): DiagramPoint {
  const { width, height } = getRecordDiagramNodeSize(node)
  if (port === "top") {
    return { x: node.position.x + width / 2, y: node.position.y }
  }
  if (port === "bottom") {
    return {
      x: node.position.x + width / 2,
      y: node.position.y + height,
    }
  }
  if (port === "left") {
    return { x: node.position.x, y: node.position.y + height / 2 }
  }
  return {
    x: node.position.x + width,
    y: node.position.y + height / 2,
  }
}

export function computeRecordDiagramBounds(nodes: RecordDiagramNode[]) {
  if (nodes.length === 0) return { width: 900, height: 620, offsetX: 0, offsetY: 0 }
  let minX = 0
  let minY = 0
  let maxX = 900
  let maxY = 620
  for (const node of nodes) {
    const { width, height } = getRecordDiagramNodeSize(node)
    minX = Math.min(minX, node.position.x - 100)
    minY = Math.min(minY, node.position.y - 100)
    maxX = Math.max(maxX, node.position.x + width + 100)
    maxY = Math.max(maxY, node.position.y + height + 100)
  }
  return {
    width: maxX - minX,
    height: maxY - minY,
    offsetX: minX,
    offsetY: minY,
  }
}

export function getRecordDiagramNodesBounds(
  nodes: RecordDiagramNode[],
  selectedIds: Set<string>,
) {
  const selected = nodes.filter((node) => selectedIds.has(node.id))
  if (selected.length === 0) return null
  const minX = Math.min(...selected.map((node) => node.position.x))
  const minY = Math.min(...selected.map((node) => node.position.y))
  const maxX = Math.max(...selected.map((node) => (
    node.position.x + getRecordDiagramNodeSize(node).width
  )))
  const maxY = Math.max(...selected.map((node) => (
    node.position.y + getRecordDiagramNodeSize(node).height
  )))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function placeRecordDiagramNode(
  nodes: RecordDiagramNode[],
  parent?: RecordDiagramNode | null
): DiagramPoint {
  if (parent) {
    const parentSize = getRecordDiagramNodeSize(parent)
    const siblings = nodes.filter(
      (node) => Math.abs(node.position.x - (
        parent.position.x + parentSize.width + RECORD_NODE_HORIZONTAL_GAP
      )) < 20
    )
    return {
      x: parent.position.x + parentSize.width + RECORD_NODE_HORIZONTAL_GAP,
      y: siblings.reduce((bottom, node) => Math.max(
        bottom,
        node.position.y + getRecordDiagramNodeSize(node).height + RECORD_NODE_VERTICAL_GAP,
      ), parent.position.y),
    }
  }

  const index = nodes.length
  return {
    x: 80 + (index % 3) * (RECORD_NODE_WIDTH + RECORD_NODE_HORIZONTAL_GAP),
    y: 80 + Math.floor(index / 3) * (RECORD_NODE_HEIGHT + RECORD_NODE_VERTICAL_GAP),
  }
}

function clampSize(value: number, minimum: number, maximum: number) {
  return Math.round(Math.max(minimum, Math.min(value, maximum)))
}

export function sortRecordDiagram(
  nodes: RecordDiagramNode[],
  edges: RecordDiagramEdge[]
): RecordDiagramNode[] {
  if (nodes.length === 0) return []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  const children = new Map(nodes.map((node) => [node.id, [] as string[]]))

  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1)
    children.get(edge.source)?.push(edge.target)
  }

  const roots = nodes
    .filter((node) => (incoming.get(node.id) || 0) === 0)
    .sort((left, right) => left.title.localeCompare(right.title))
  const queue = roots.map((node) => ({ id: node.id, depth: 0 }))
  const visited = new Set<string>()
  const rowsByDepth = new Map<number, string[]>()

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)
    const row = rowsByDepth.get(current.depth) || []
    row.push(current.id)
    rowsByDepth.set(current.depth, row)
    for (const child of children.get(current.id) || []) {
      queue.push({ id: child, depth: current.depth + 1 })
    }
  }

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    const row = rowsByDepth.get(0) || []
    row.push(node.id)
    rowsByDepth.set(0, row)
  }

  const positions = new Map<string, DiagramPoint>()
  let columnX = 80
  for (const depth of [...rowsByDepth.keys()].sort((left, right) => left - right)) {
    const ids = rowsByDepth.get(depth) || []
    let rowY = 80
    let columnWidth = 0
    for (const id of ids) {
      const node = byId.get(id)
      if (!node) continue
      const size = getRecordDiagramNodeSize(node)
      positions.set(id, { x: columnX, y: rowY })
      rowY += size.height + RECORD_NODE_VERTICAL_GAP
      columnWidth = Math.max(columnWidth, size.width)
    }
    columnX += columnWidth + RECORD_NODE_HORIZONTAL_GAP
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) || node.position,
  }))
}

export function layoutRecordDiagram(
  nodes: RecordDiagramNode[],
  edges: RecordDiagramEdge[],
  layout: RecordDiagramLayout,
): RecordDiagramNode[] {
  if (layout === "hierarchy") return sortRecordDiagram(nodes, edges)
  const ordered = [...nodes].sort((left, right) => (
    left.position.y - right.position.y
    || left.position.x - right.position.x
    || left.title.localeCompare(right.title)
  ))
  const gridColumns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)))
  const gridRows = Math.ceil(ordered.length / gridColumns)
  const columnWidths = Array.from({ length: gridColumns }, () => 0)
  const rowHeights = Array.from({ length: gridRows }, () => 0)
  ordered.forEach((node, index) => {
    const size = getRecordDiagramNodeSize(node)
    const column = index % gridColumns
    const row = Math.floor(index / gridColumns)
    columnWidths[column] = Math.max(columnWidths[column], size.width)
    rowHeights[row] = Math.max(rowHeights[row], size.height)
  })
  const columnX = columnWidths.map((_, index) => (
    80 + columnWidths.slice(0, index).reduce(
      (total, width) => total + width + RECORD_NODE_HORIZONTAL_GAP,
      0,
    )
  ))
  const rowY = rowHeights.map((_, index) => (
    80 + rowHeights.slice(0, index).reduce(
      (total, height) => total + height + RECORD_NODE_VERTICAL_GAP,
      0,
    )
  ))
  let linearOffset = 80
  return ordered.map((node, index) => {
    const size = getRecordDiagramNodeSize(node)
    const column = index % gridColumns
    const row = Math.floor(index / gridColumns)
    const position = layout === "columns"
      ? { x: 80, y: linearOffset }
      : layout === "rows"
        ? { x: linearOffset, y: 80 }
        : { x: columnX[column], y: rowY[row] }
    linearOffset += (
      layout === "columns" ? size.height + RECORD_NODE_VERTICAL_GAP : size.width + RECORD_NODE_HORIZONTAL_GAP
    )
    return {
      ...node,
      position,
    }
  })
}

export function layoutSelectedRecordDiagram(
  nodes: RecordDiagramNode[],
  edges: RecordDiagramEdge[],
  selectedIds: Set<string>,
  layout: RecordDiagramLayout,
): RecordDiagramNode[] {
  const selected = nodes.filter((node) => selectedIds.has(node.id))
  if (selected.length < 2) return nodes
  const selectedEdges = edges.filter(
    (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target),
  )
  const arranged = layoutRecordDiagram(selected, selectedEdges, layout)
  const originX = Math.min(...selected.map((node) => node.position.x))
  const originY = Math.min(...selected.map((node) => node.position.y))
  const arrangedMinX = Math.min(...arranged.map((node) => node.position.x))
  const arrangedMinY = Math.min(...arranged.map((node) => node.position.y))
  const arrangedById = new Map(arranged.map((node) => [
    node.id,
    {
      ...node.position,
      x: node.position.x + originX - arrangedMinX,
      y: node.position.y + originY - arrangedMinY,
    },
  ]))
  return nodes.map((node) => {
    const position = arrangedById.get(node.id)
    return position ? { ...node, position } : node
  })
}

export function isDiagramInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest([
    "button",
    "input",
    "textarea",
    "select",
    "a",
    "[role='button']",
    "[role='combobox']",
    "[role='listbox']",
  ].join(", ")))
}
