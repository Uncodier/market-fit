/**
 * Normalize origin value: replace "lead_generation_workflow" with "Makinari"
 */
export function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null
  return origin === "lead_generation_workflow" ? "Makinari" : origin
}
