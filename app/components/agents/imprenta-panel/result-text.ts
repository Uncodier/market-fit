/** Read text results without treating structured media as a JSON text response. */
export function extractImprentaResultText(result: Record<string, unknown> | null | undefined): string {
  if (!result) return ""
  if (typeof result.text === "string" && result.text.trim()) return result.text

  if (!Array.isArray(result.outputs)) return ""
  return result.outputs.flatMap((output: unknown) => {
    if (!output || typeof output !== "object") return []
    const item = output as Record<string, unknown>
    if (item.type !== "text") return []
    const data = item.data && typeof item.data === "object"
      ? item.data as Record<string, unknown> : undefined
    const text = data?.text ?? item.text
    return typeof text === "string" && text.trim() ? [text] : []
  }).join("\n\n")
}