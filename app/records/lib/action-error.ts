/** Preserve meaningful action messages without assuming a thrown value is an Error. */
export function getRecordActionError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message
    if (typeof message === "string" && message.length > 0) return message
  }
  return fallback
}