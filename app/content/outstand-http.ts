import "server-only"
import { isIP } from "node:net"
import { accountIdSchema, OutstandBoundaryError, UNCONFIRMED_DELETE, UNCONFIRMED_PUBLISH } from "./outstand-contract"

export const OUTSTAND_TIMEOUT_MS = 30_000
export const OUTSTAND_RESPONSE_LIMIT = 1_000_000
export const OUTSTAND_DELETE_TIMEOUT_MS = 90_000

function postsUrl(siteId: string, method: "GET" | "POST"): URL {
  const configured = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_SERVER_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : "")
  try {
    const url = new URL(configured)
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    const development = local && process.env.NODE_ENV !== "production"
    if (url.username || url.password || url.hash || url.search || url.pathname !== "/" ||
      /[\s\\]/.test(configured) || (!development && (url.protocol !== "https:" || url.port || local ||
        isIP(url.hostname.replace(/^\[|\]$/g, "")) || !url.hostname.includes(".") || url.hostname.endsWith(".local"))) ||
      (development && !["http:", "https:"].includes(url.protocol))) throw new Error()
    url.pathname = "/api/integrations/outstand/posts"
    url.searchParams.set("tenant_id", siteId)
    if (method === "GET") url.searchParams.set("limit", "50")
    return url
  } catch {
    throw new OutstandBoundaryError(503, "The social publishing API is not configured safely.")
  }
}

function cancelBody(response: Response) {
  void response.body?.cancel().catch(() => {})
}

async function responseJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json") ||
    Number(response.headers.get("content-length")) > OUTSTAND_RESPONSE_LIMIT || !response.body) {
    cancelBody(response)
    throw new OutstandBoundaryError(502, "The social publishing API returned an invalid response.")
  }
  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener("abort", cancel, { once: true })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > OUTSTAND_RESPONSE_LIMIT) throw new Error()
      chunks.push(value)
    }
    signal.throwIfAborted()
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } finally {
    cancel()
    signal.removeEventListener("abort", cancel)
    reader.releaseLock()
  }
}

export async function requestOutstandPosts(
  siteId: string, token: string, method: "GET" | "POST", payload?: unknown,
): Promise<unknown> {
  const url = postsUrl(siteId, method)
  const fallback = method === "POST" ? UNCONFIRMED_PUBLISH : "Unable to load social posts."
  return requestOutstand(url, token, method, fallback, OUTSTAND_TIMEOUT_MS, payload)
}

export async function requestOutstandContentDeletion(siteId: string, token: string, postId: string): Promise<unknown> {
  if (!accountIdSchema.safeParse(postId).success) throw new OutstandBoundaryError(400, "Invalid social post ID.")
  const url = postsUrl(siteId, "POST")
  // A new endpoint fails safely on older API deployments. The legacy DELETE
  // only removes the provider record and must never substitute for this flow.
  url.pathname += `/${encodeURIComponent(postId)}/with-content`
  return requestOutstand(url, token, "DELETE", UNCONFIRMED_DELETE, OUTSTAND_DELETE_TIMEOUT_MS)
}

async function requestOutstand(
  url: URL, token: string, method: "GET" | "POST" | "DELETE", fallback: string,
  timeoutMs: number, payload?: unknown,
): Promise<unknown> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new OutstandBoundaryError(504, fallback))
    }, timeoutMs)
  })
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        cancelBody(response)
        controller.signal.throwIfAborted()
      }
      if (!response.ok) {
        cancelBody(response)
        const status = [400, 401, 403, 404, 409, 422, 429, 503].includes(response.status) ? response.status : 502
        throw new OutstandBoundaryError(status, status === 401 ? "Sign in again to access social posts."
          : status === 403 ? "Access to these social posts was denied."
          : method === "DELETE" && status === 409
            ? "Not all social posts could be deleted. Check Outstand and remove any remaining posts manually before deleting the local content."
            : fallback)
      }
      return responseJson(response, controller.signal)
    })()])
  } finally {
    if (timer) clearTimeout(timer)
  }
}