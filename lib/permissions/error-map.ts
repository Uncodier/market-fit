import type { PermissionCommand } from "./types"

const RLS_CODES = new Set(["42501", "PGRST301"])
const RLS_MESSAGE = /row-level security|permission denied|violates row-level/i

export function permissionDeniedMessage(command: PermissionCommand): string {
  switch (command) {
    case "insert":
      return "You don't have permission to create this."
    case "delete":
      return "You don't have permission to delete this."
    case "select":
      return "You don't have permission to view this."
    default:
      return "You don't have permission to save changes."
  }
}

export function isRlsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const record = error as { code?: unknown; message?: unknown }
  const code = typeof record.code === "string" ? record.code : ""
  const message = typeof record.message === "string" ? record.message : ""
  if (RLS_CODES.has(code)) return true
  return RLS_MESSAGE.test(message)
}

export function inferCommandFromError(error: unknown): PermissionCommand {
  if (!error || typeof error !== "object") return "update"
  const message = String((error as { message?: unknown }).message || "").toLowerCase()
  if (message.includes("delete")) return "delete"
  if (message.includes("insert") || message.includes("create")) return "insert"
  return "update"
}

export function mapPermissionError<T extends { message?: string; code?: string }>(
  error: T,
  command: PermissionCommand = inferCommandFromError(error)
): T {
  if (!isRlsError(error)) return error
  return { ...error, message: permissionDeniedMessage(command) }
}
