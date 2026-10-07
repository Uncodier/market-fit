/** @jest-environment node */

import { NextRequest, NextResponse } from "next/server"
import { middleware } from "@/app/middleware"
import { enforceApiAdmission } from "@/lib/redis/api-admission"
import { getMiddlewareUser } from "@/lib/supabase/middleware-client"

jest.mock("@/lib/redis/api-admission", () => ({ enforceApiAdmission: jest.fn() }))
jest.mock("@/lib/supabase/middleware-client", () => ({
  copyResponseCookies: jest.fn(), getMiddlewareUser: jest.fn(),
}))
jest.mock("@/lib/auth/enforce-screen-access", () => ({ resolveBlockedScreenRedirect: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(enforceApiAdmission).mockResolvedValue(null)
})

it.each(["GET", "HEAD", "OPTIONS"])("leaves version %s CORS to the route without skipping API admission", async method => {
  const request = new NextRequest("https://app.makinari.com/api/version", {
    method, headers: { origin: "https://www.makinari.com" },
  })
  const response = await middleware(request)
  expect(response.headers.get("x-middleware-next")).toBe("1")
  expect(response.headers.get("access-control-allow-origin")).toBeNull()
  expect(response.headers.get("access-control-allow-methods")).toBeNull()
  expect(response.headers.get("access-control-allow-credentials")).toBeNull()
  expect(enforceApiAdmission).toHaveBeenCalledWith(request)
  expect(getMiddlewareUser).not.toHaveBeenCalled()
})

it("does not bypass an API admission denial", async () => {
  jest.mocked(enforceApiAdmission).mockResolvedValueOnce(NextResponse.json({}, { status: 429 }))
  const response = await middleware(new NextRequest("https://app.makinari.com/api/version"))
  expect(response.status).toBe(429)
  expect(response.headers.get("x-middleware-next")).toBeNull()
})

it.each(["GET", "OPTIONS"])("keeps the existing CORS policy on other API %s requests", async method => {
  const response = await middleware(new NextRequest("https://app.makinari.com/api/fx/rates", {
    method, headers: { origin: "https://www.makinari.com" },
  }))
  expect(response.status).toBe(method === "OPTIONS" ? 204 : 200)
  expect(response.headers.get("access-control-allow-origin")).toBe("https://www.makinari.com")
  expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  expect(response.headers.get("access-control-allow-methods")).toContain("POST")
})