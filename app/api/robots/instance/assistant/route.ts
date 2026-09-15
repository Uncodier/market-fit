import { NextRequest, NextResponse } from "next/server"

const ASSISTANT_PATH = "/api/robots/instance/assistant"

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
    const headers = new Headers()
    for (const name of ["authorization", "content-type", "accept", "x-api-key"]) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      cache: "no-store",
    })

    const responseHeaders = new Headers()
    for (const name of ["content-type", "cache-control", "x-workflow-run-id"]) {
      const value = response.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
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
