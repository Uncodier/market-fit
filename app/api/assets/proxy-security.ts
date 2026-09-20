import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 3

export class AssetProxyError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "AssetProxyError"
  }
}

function configuredNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name])
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const ASSET_PROXY_MAX_BYTES = configuredNumber(
  "ASSET_PROXY_MAX_BYTES",
  DEFAULT_MAX_BYTES
)

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "")
}

function hostnameFromEnvironment(name: string): string | null {
  const value = process.env[name]
  if (!value) return null

  try {
    return normalizeHostname(new URL(value).hostname)
  } catch {
    return null
  }
}

export function getAllowedAssetHostnames(): Set<string> {
  return new Set(
    [
      "db.makinari.com",
      hostnameFromEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      hostnameFromEnvironment("NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL"),
    ].filter((hostname): hostname is string => Boolean(hostname))
  )
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".")
  if (parts.length !== 4) return null
  const octets = parts.map(Number)
  return octets.every(
    (part, index) =>
      Number.isInteger(part) &&
      part >= 0 &&
      part <= 255 &&
      String(part) === parts[index]
  )
    ? octets
    : null
}

function isPrivateIpv4(address: string): boolean {
  const octets = parseIpv4(address)
  if (!octets) return true
  const [a, b] = octets

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  )
}

function expandIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split("%")[0]
  const [left = "", right = ""] = normalized.split("::")
  if (normalized.split("::").length > 2) return null

  const parseSide = (side: string): number[] | null => {
    if (!side) return []
    const groups: number[] = []
    for (const part of side.split(":")) {
      if (part.includes(".")) {
        const ipv4 = parseIpv4(part)
        if (!ipv4) return null
        groups.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3])
        continue
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null
      groups.push(Number.parseInt(part, 16))
    }
    return groups
  }

  const leftGroups = parseSide(left)
  const rightGroups = parseSide(right)
  if (!leftGroups || !rightGroups) return null

  if (!normalized.includes("::")) {
    return leftGroups.length === 8 ? leftGroups : null
  }

  const missing = 8 - leftGroups.length - rightGroups.length
  if (missing < 1) return null
  return [...leftGroups, ...Array(missing).fill(0), ...rightGroups]
}

function isPrivateIpv6(address: string): boolean {
  const groups = expandIpv6(address)
  if (!groups) return true

  const isUnspecified = groups.every((group) => group === 0)
  const isLoopback =
    groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1
  const isUniqueLocal = (groups[0] & 0xfe00) === 0xfc00
  const isLinkLocal = (groups[0] & 0xffc0) === 0xfe80
  const isMulticast = (groups[0] & 0xff00) === 0xff00
  const isDocumentation = groups[0] === 0x2001 && groups[1] === 0x0db8
  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff

  if (isIpv4Mapped) {
    const ipv4 = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`
    return isPrivateIpv4(ipv4)
  }

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isMulticast ||
    isDocumentation
  )
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isPrivateIpv6(address)
  return true
}

async function assertPublicHostname(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new AssetProxyError("Private network targets are not allowed", 403)
    }
    return
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new AssetProxyError("Asset hostname could not be resolved", 400)
  }

  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new AssetProxyError("Private network targets are not allowed", 403)
  }
}

export async function validateAssetUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new AssetProxyError("Invalid URL", 400)
  }

  const hostname = normalizeHostname(url.hostname)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !getAllowedAssetHostnames().has(hostname)
  ) {
    throw new AssetProxyError("URL is not authorized for proxy", 403)
  }

  await assertPublicHostname(hostname)
  return url
}

export function validateRangeHeader(
  rangeHeader: string | null,
  maxBytes = ASSET_PROXY_MAX_BYTES
): string | null {
  if (!rangeHeader) return null
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) {
    throw new AssetProxyError("Invalid range", 416)
  }

  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : null
  if (
    !Number.isSafeInteger(start) ||
    (end !== null &&
      (!Number.isSafeInteger(end) || end < start || end - start + 1 > maxBytes))
  ) {
    throw new AssetProxyError("Requested range is too large", 416)
  }

  return rangeHeader
}

type ValidatedAssetFetch = {
  response: Response
  dispose: () => void
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  )
}

export async function fetchValidatedAsset(
  initialUrl: URL,
  headers: HeadersInit,
  options: { sameHostRedirectsOnly?: boolean } = {}
): Promise<ValidatedAssetFetch> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    configuredNumber("ASSET_PROXY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)
  )
  const dispose = () => clearTimeout(timeout)
  let currentUrl = initialUrl

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: controller.signal,
      })

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        return { response, dispose }
      }

      if (redirects === MAX_REDIRECTS) {
        throw new AssetProxyError("Too many redirects", 502)
      }

      const location = response.headers.get("location")
      if (!location) {
        throw new AssetProxyError("Invalid redirect", 502)
      }

      await response.body?.cancel()
      const nextUrl = await validateAssetUrl(new URL(location, currentUrl).toString())
      if (
        options.sameHostRedirectsOnly &&
        normalizeHostname(nextUrl.hostname) !== normalizeHostname(initialUrl.hostname)
      ) {
        throw new AssetProxyError("Cross-host redirects are not allowed", 403)
      }
      currentUrl = nextUrl
    }
  } catch (error) {
    dispose()
    if (isAbortError(error)) {
      throw new AssetProxyError("Asset request timed out", 504)
    }
    throw error
  }

  dispose()
  throw new AssetProxyError("Too many redirects", 502)
}

export async function readLimitedBody(
  response: Response,
  maxBytes = ASSET_PROXY_MAX_BYTES
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AssetProxyError("Asset exceeds the size limit", 413)
  }

  try {
    if (!response.body?.getReader) {
      const buffer = new Uint8Array(await response.arrayBuffer())
      if (buffer.byteLength > maxBytes) {
        throw new AssetProxyError("Asset exceeds the size limit", 413)
      }
      return buffer
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        throw new AssetProxyError("Asset exceeds the size limit", 413)
      }
      chunks.push(value)
    }

    const body = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return body
  } catch (error) {
    if (isAbortError(error)) {
      throw new AssetProxyError("Asset request timed out", 504)
    }
    throw error
  }
}

export function createLimitedBodyStream(
  response: Response,
  onDone: () => void,
  maxBytes = ASSET_PROXY_MAX_BYTES
): BodyInit {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    onDone()
    throw new AssetProxyError("Asset exceeds the size limit", 413)
  }

  if (!response.body) {
    onDone()
    return new Uint8Array()
  }

  const reader = response.body.getReader()
  let totalBytes = 0

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          onDone()
          controller.close()
          return
        }

        totalBytes += value.byteLength
        if (totalBytes > maxBytes) {
          await reader.cancel()
          onDone()
          controller.error(
            new AssetProxyError("Asset exceeds the size limit", 413)
          )
          return
        }
        controller.enqueue(value)
      } catch (error) {
        onDone()
        controller.error(error)
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason)
      } finally {
        onDone()
      }
    },
  })
}
