import { InstanceNode } from "@/app/types/instance-nodes"

export function positionsNearlyEqual(
  a: { x: number; y: number },
  b: { x: number; y: number },
  eps = 1
) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
}

export function isImprentaWorkflowActionNode(node: InstanceNode): boolean {
  if (node.id.startsWith("dummy-")) return false
  const t = node.type
  return t === "prompt" || t === "publish" || t.startsWith("generate-")
}

export function isImprentaUploadedNode(node: InstanceNode): boolean {
  const source = (node.settings)?.imprenta_source
  return source === "upload"
}

export const IMPRENTA_MODE_OPTIONS: readonly { type: string; label: string }[] = [
  { type: "prompt", label: "Text" },
  { type: "generate-image", label: "Image" },
  { type: "generate-video", label: "Video" },
  { type: "generate-audio", label: "Audio" },
  { type: "generate-audience", label: "Audience" },
  { type: "publish", label: "Publish" },
]

export function imprentaSettingsForClonedType(
  newType: string,
  previous: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...previous }
  if (newType === "prompt") {
    out.media_type = "text"
  } else if (newType === "generate-audience") {
    out.media_type = "audience"
  } else if (newType === "publish") {
    delete out.media_type
  } else if (newType.startsWith("generate-")) {
    out.media_type = newType.replace("generate-", "")
  }
  return out
}

export function cloneInstanceNodeContextRowForInsert(
  row: Record<string, unknown>,
  newTargetId: string,
  siteId: string,
  userId: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row }
  delete next.id
  delete next.created_at
  delete next.updated_at
  next.target_node_id = newTargetId
  next.site_id = siteId
  next.user_id = userId
  return next
}

export function collectNodeAndAncestorIds(nodeId: string, allNodes: InstanceNode[]): Set<string> {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const out = new Set<string>()
  let cur: string | null = nodeId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    out.add(cur)
    const n = byId.get(cur)
    cur = n?.parent_node_id ?? null
  }
  return out
}
