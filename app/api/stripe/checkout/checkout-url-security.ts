type CheckoutUrls =
  | { successUrl: string; cancelUrl: string; error?: undefined }
  | { error: string; successUrl?: undefined; cancelUrl?: undefined }

const PLATFORM_ORIGINS = new Set([
  "https://makinari.com",
  "https://www.makinari.com",
  "https://app.makinari.com",
  "https://demo.makinari.com",
  "https://uncodie.com",
  "https://www.uncodie.com",
  "https://app.uncodie.com",
  "https://aimarket.fit",
  "https://www.aimarket.fit",
  "https://app.aimarket.fit",
])

function normalizedOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isLocalOrigin(origin: string): boolean {
  const url = new URL(origin)
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  )
}

function allowedOrigins(): Set<string> {
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.CHECKOUT_RETURN_ORIGINS || "").split(","),
  ]
    .map((value) => normalizedOrigin(value?.trim()))
    .filter((value): value is string => Boolean(value))

  return new Set([...PLATFORM_ORIGINS, ...configured])
}

function trustedRequestOrigin(request: Request): string | null {
  const origin = normalizedOrigin(request.headers.get("origin"))
  if (!origin) return null
  const configuredOrigins = allowedOrigins()
  if (isLocalOrigin(origin)) {
    return process.env.NODE_ENV !== "production" ||
      configuredOrigins.has(origin)
      ? origin
      : null
  }
  return configuredOrigins.has(origin) ? origin : null
}

function safeReturnUrl(value: unknown, allowedOrigin: string): URL | null {
  if (typeof value !== "string" || !value.trim()) return null

  try {
    const url = new URL(value)
    if (url.origin !== allowedOrigin) return null
    if (url.protocol !== "https:" && !isLocalOrigin(url.origin)) return null
    return url
  } catch {
    return null
  }
}

export function resolveCheckoutUrls(
  request: Request,
  returnUrl: unknown,
  successUrl: unknown,
  successParams: Record<string, string>
): CheckoutUrls {
  const origin = trustedRequestOrigin(request)
  if (!origin) return { error: "A trusted checkout origin is required" }

  const safeReturn = safeReturnUrl(returnUrl, origin)
  if (!safeReturn) return { error: "Invalid checkout return URL" }

  const safeSuccess = successUrl
    ? safeReturnUrl(successUrl, origin)
    : new URL(safeReturn)
  if (!safeSuccess) return { error: "Invalid checkout success URL" }

  if (!successUrl) {
    for (const [key, value] of Object.entries(successParams)) {
      safeSuccess.searchParams.set(key, value)
    }
  }

  const cancel = new URL(safeReturn)
  cancel.searchParams.set("canceled", "true")

  return {
    successUrl: safeSuccess.toString(),
    cancelUrl: cancel.toString(),
  }
}
