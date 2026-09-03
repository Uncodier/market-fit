export function getApiServerUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || ""
  if (!base) return ""
  if (base.startsWith("http://") || base.startsWith("https://")) return base
  const lower = base.toLowerCase()
  const isLocal =
    lower.startsWith("localhost") ||
    lower.startsWith("127.0.0.1") ||
    lower.startsWith("0.0.0.0")
  return `${isLocal ? "http" : "https"}://${base}`
}

export function getOutstandIntegrationUrl(path: string): string {
  const apiServerUrl = getApiServerUrl() || "http://localhost:3001"
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${apiServerUrl}/api/integrations/outstand${normalized}`
}
