import { NextRequest, NextResponse } from "next/server"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"
import {
  timingSafeEqual,
} from "node:crypto"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import {
  strengthenImprentaAssistantPayload,
  type ImprentaNodeSnapshot,
} from "./imprenta-contract"
import {
  acquireOperationLease,
  releaseLeasesWithStream,
  type OperationLease,
} from "@/lib/redis/operation-lease"

const ASSISTANT_PATH = "/api/robots/instance/assistant"
const MAX_BODY_BYTES = 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 60_000

function hasValidServiceApiKey(request: Request): boolean {
  const provided = request.headers.get("x-api-key")?.trim()
  const expected = process.env.SERVICE_API_KEY?.trim()
  if (!provided || !expected) return false
  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  )
}

function getServerApiUrl(): string {
  const value = (
    process.env.API_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_SERVER_URL ||
    ""
  ).trim()

  if (!value) return ""

  const withProtocol = /^https?:\/\//i.test(value)
    ? value
    : `${/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/i.test(value) ? "http" : "https"}://${value}`

  return withProtocol.replace(/\/+$/, "")
}

export async function POST(request: NextRequest) {
  const leases: OperationLease[] = []
  const apiServerUrl = getServerApiUrl()

  if (!apiServerUrl) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "API_SERVER_URL is not configured" },
      },
      { status: 503 }
    )
  }

  const targetUrl = new URL(ASSISTANT_PATH, `${apiServerUrl}/`)
  if (targetUrl.origin === request.nextUrl.origin) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "API_SERVER_URL points to the web application instead of the API server" },
      },
      { status: 503 }
    )
  }

  try {
    const body = await readLimitedRequestBody(request, MAX_BODY_BYTES)
    let parsedBody: Record<string, unknown>
    try {
      parsedBody = JSON.parse(decodeRequestBody(body))
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid JSON payload" } },
        { status: 400 }
      )
    }
    const siteId =
      typeof parsedBody.site_id === "string" ? parsedBody.site_id : ""
    if (!siteId) {
      return NextResponse.json(
        { success: false, error: { message: "site_id is required" } },
        { status: 400 }
      )
    }
    let verifiedImportAuthorization: string | null = null
    if (!hasValidServiceApiKey(request)) {
      const access = await requireSiteAccess(request, siteId)
      if (access.error) return access.error
      parsedBody.user_id = access.userId
      if (typeof parsedBody.message === "string" && /^import reviewed skill:/i.test(parsedBody.message.trim())) {
        if (access.role !== "owner" && access.role !== "admin") {
          return NextResponse.json({ error: { message: "Site manager access required to import skills" } }, { status: 403 })
        }
        const { data: { session }, error: sessionError } = await access.supabase.auth.getSession()
        if (sessionError || !session?.access_token || session.user?.id !== access.userId) {
          return NextResponse.json({ error: { message: "Authenticated session required to import skills" } }, { status: 401 })
        }
        verifiedImportAuthorization = `Bearer ${session.access_token}`
      }

      const nodeId =
        typeof parsedBody.instance_node_id === "string"
          ? parsedBody.instance_node_id
          : ""
      if (nodeId) {
        const { data: node, error: nodeError } = await access.supabase
          .from("instance_nodes")
          .select("id, instance_id, site_id, type, prompt, settings, updated_at")
          .eq("id", nodeId)
          .eq("site_id", siteId)
          .maybeSingle()
        if (nodeError || !node) {
          return NextResponse.json(
            { success: false, error: { message: "Imprenta node not found" } },
            { status: 404 }
          )
        }
        if (
          typeof parsedBody.instance_id === "string"
          && parsedBody.instance_id !== node.instance_id
        ) {
          return NextResponse.json(
            { success: false, error: { message: "Node does not belong to the requested instance" } },
            { status: 409 }
          )
        }
        parsedBody = strengthenImprentaAssistantPayload(
          parsedBody,
          node as ImprentaNodeSnapshot
        )
      }
    } else {
      parsedBody = strengthenImprentaAssistantPayload(parsedBody)
    }

    const executionId =
      (typeof parsedBody.instance_node_id === "string"
        && parsedBody.instance_node_id)
      || (typeof parsedBody.instance_id === "string" && parsedBody.instance_id)
      || siteId
    const executionLease = await acquireOperationLease(
      "assistant-execution",
      executionId,
      UPSTREAM_TIMEOUT_MS + 15_000,
    )
    if (!executionLease) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "This assistant execution is already in progress" },
        },
        { status: 409, headers: { "Retry-After": "5" } },
      )
    }
    leases.push(executionLease)

    const globalLease = await acquireOperationLease(
      "assistant-execution-global",
      "global",
      UPSTREAM_TIMEOUT_MS + 15_000,
      8,
    )
    if (!globalLease) {
      await executionLease.release()
      leases.length = 0
      return NextResponse.json(
        {
          success: false,
          error: { message: "Assistant capacity is temporarily full" },
        },
        { status: 503, headers: { "Retry-After": "5" } },
      )
    }
    leases.push(globalLease)

    const headers = new Headers()
    for (const name of ["authorization", "content-type", "accept", "x-api-key"]) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }

    if (verifiedImportAuthorization) {
      headers.delete("x-api-key")
      headers.set("authorization", verifiedImportAuthorization)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(parsedBody),
        cache: "no-store",
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const responseHeaders = new Headers()
    for (const name of ["content-type", "cache-control", "x-workflow-run-id"]) {
      const value = response.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }

    return new Response(releaseLeasesWithStream(response.body, leases), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    await Promise.allSettled(leases.map((lease) => lease.release()))
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        {
          success: false,
          error: { message: error.message },
        },
        { status: error.status }
      )
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        {
          success: false,
          error: { message: "The API server request timed out" },
        },
        { status: 504 }
      )
    }
    console.error("Failed to proxy assistant request to API server:", error)
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to reach the API server" },
      },
      { status: 502 }
    )
  }
}
