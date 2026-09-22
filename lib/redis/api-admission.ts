import { NextResponse, type NextRequest } from "next/server"
import {
  checkRateLimit,
  hashRedisKeyPart,
  rateLimitError,
  type RateLimitPolicy,
} from "@/lib/redis/control-plane"

type RoutePolicy = RateLimitPolicy & { routeClass: string }

function routePolicy(pathname: string): RoutePolicy | null {
  const failureMode =
    process.env.REDIS_REQUIRED === "true" ? "closed" : "open"

  if (
    pathname.startsWith("/api/performance/") ||
    pathname.startsWith("/api/traffic/") ||
    [
      "/api/revenue",
      "/api/ltv",
      "/api/cac",
      "/api/cpl",
      "/api/roi",
      "/api/active-users",
      "/api/active-segments",
      "/api/active-campaigns",
      "/api/clients-by-segment",
      "/api/clients-by-campaign",
      "/api/revenue-by-segment",
      "/api/revenue-by-campaign",
      "/api/cohorts",
      "/api/leads-cohorts",
      "/api/visitor-cohorts",
      "/api/campaign-revenue",
      "/api/recent-activity",
      "/api/sales",
      "/api/dashboard/export",
    ].includes(pathname) ||
    pathname === "/api/dashboard/overview" ||
    pathname === "/api/dashboard/performance"
  ) {
    return {
      routeClass: "analytics",
      limit: 120,
      windowSeconds: 60,
      failureMode,
    }
  }
  if (
    pathname === "/api/assets/proxy"
    || pathname === "/api/assets/proxy-zip"
  ) {
    return {
      routeClass: "asset-proxy",
      limit: 10,
      windowSeconds: 60,
      failureMode,
    }
  }
  if (pathname === "/api/robots/instance/assistant") {
    return {
      routeClass: "assistant-proxy",
      limit: 10,
      windowSeconds: 60,
      failureMode,
    }
  }
  if (
    pathname === "/api/waitlist-signup" ||
    pathname === "/api/whatsapp-setup"
  ) {
    return {
      routeClass: "public-mutation",
      limit: 5,
      windowSeconds: 600,
      failureMode,
    }
  }
  if (
    pathname === "/api/webhooks/appsumo" ||
    pathname === "/api/agents/whatsapp"
  ) {
    return {
      routeClass: "signed-webhook",
      limit: 120,
      windowSeconds: 60,
      failureMode,
    }
  }
  if (
    pathname.startsWith("/api/stripe/checkout/") ||
    pathname === "/api/stripe/portal"
  ) {
    return {
      routeClass: "stripe-session",
      limit: 20,
      windowSeconds: 300,
      failureMode,
    }
  }
  if (
    pathname.startsWith("/api/trends") ||
    pathname.startsWith("/api/integrations/cloudflare") ||
    pathname === "/api/dns/verify-mx" ||
    pathname === "/api/geocode" ||
    pathname === "/api/route/preview"
  ) {
    return {
      routeClass: "provider",
      limit: 30,
      windowSeconds: 60,
      failureMode,
    }
  }
  if (
    pathname === "/api/leads/export" ||
    pathname === "/api/sales/export" ||
    pathname === "/api/records/embed" ||
    pathname === "/api/conversations/accept-all-pending" ||
    pathname === "/api/conversations/reject-all-pending"
  ) {
    return {
      routeClass: "background-work",
      limit: 5,
      windowSeconds: 600,
      failureMode,
    }
  }
  return null
}

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  )
}

export async function enforceApiAdmission(
  request: NextRequest
): Promise<NextResponse | null> {
  const policy = routePolicy(request.nextUrl.pathname)
  const ip = clientIp(request)
  if (!policy || !ip) return null

  const ipHash = await hashRedisKeyPart(ip)
  const result = await checkRateLimit(
    `rl:v1:${policy.routeClass}:ip:${ipHash}`,
    policy
  )
  return result.allowed ? null : rateLimitError(result)
}
