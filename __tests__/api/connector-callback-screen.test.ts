/** @jest-environment node */
import { NextRequest, NextResponse } from "next/server"
import { resolveBlockedScreenRedirect } from "@/lib/auth/enforce-screen-access"
import { createMiddlewareSupabase } from "@/lib/supabase/middleware-client"

jest.mock("@/lib/supabase/middleware-client", () => ({ createMiddlewareSupabase: jest.fn() }))

it("does not use the currently selected site to redirect a connector callback", async () => {
  const request = new NextRequest("https://app.example.test/connectors/callback?session_uri=opaque", {
    headers: { cookie: "mf_current_site_id=11111111-1111-4111-8111-111111111111" },
  })
  expect(await resolveBlockedScreenRedirect(request, NextResponse.next(), "actor")).toBeNull()
  expect(createMiddlewareSupabase).not.toHaveBeenCalled()
})