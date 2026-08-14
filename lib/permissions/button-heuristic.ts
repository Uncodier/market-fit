import type { PermissionCommand } from "./types"

const SKIP_LABEL = /^(filter|export|download|cancel|close|back|next|continue|search|apply|select)\b/i
const DELETE_LABEL = /^(delete|remove)\b/i
const SAVE_LABEL = /^(save|update)\b/i
const CREATE_LABEL = /^(create|add|new|confirm|publish|submit)\b/i

export type ButtonHeuristicInput = {
  type?: string
  variant?: string | null
  tint?: string | null
  childrenText?: string
  dataPermission?: string | null
}

function normalizeLabel(text: string | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim()
}

export function inferButtonCommand(input: ButtonHeuristicInput): PermissionCommand | null {
  if (input.dataPermission === "allow") return null

  const variant = input.variant ?? "default"
  if (variant === "ghost" || variant === "link") return null

  const label = normalizeLabel(input.childrenText)
  if (label && SKIP_LABEL.test(label)) return null

  const isDestructive = variant === "destructive" || input.tint === "destructive"
  if (isDestructive || DELETE_LABEL.test(label)) return "delete"

  if (SAVE_LABEL.test(label)) return "update"
  if (CREATE_LABEL.test(label)) return "insert"

  if (input.type === "submit") return "update"
  if (variant === "default" || variant == null) return "insert"

  return null
}

export function getNodeText(node: unknown): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join(" ")
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props
    return getNodeText(props?.children)
  }
  return ""
}
