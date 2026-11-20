/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { NextRequest } from "next/server"
import { middleware } from "@/app/middleware"

jest.mock("@/lib/redis/api-admission", () => ({ enforceApiAdmission: jest.fn(async () => null) }))
jest.mock("@/lib/supabase/middleware-client", () => ({
  getMiddlewareUser: jest.fn(async () => ({ user: null, lookupFailed: false })),
  copyResponseCookies: (_source: unknown, response: unknown) => response,
}))
jest.mock("@/lib/auth/enforce-screen-access", () => ({ resolveBlockedScreenRedirect: jest.fn() }))

it("never carries a Composio verifier proof into an unauthenticated login return URL", async () => {
  const proof = randomBytes(24).toString("hex")
  const response = await middleware(new NextRequest(`https://app.makinari.com/connectors/callback?session_uri=${proof}`))
  expect(response.status).toBe(307)
  const location = new URL(response.headers.get("location")!)
  expect(location.pathname).toBe("/auth")
  expect(location.searchParams.get("returnTo")).toBe("/connectors")
  expect(location.href).not.toContain(proof)
})