const ACCESS_ERRORS = new Set(["Forbidden", "Unauthorized", "Not authenticated", "Authentication required"])

export function isTerminalRequestError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const status = Number((error as { status?: unknown }).status)
  if (status >= 400 && status < 500) return status !== 408 && status !== 429
  return ACCESS_ERRORS.has(String((error as { message?: unknown }).message || ""))
}