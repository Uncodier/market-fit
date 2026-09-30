import { NextResponse } from "next/server"
import { createClient as createAuthClient } from "@supabase/supabase-js"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createServiceClient } from "@/lib/supabase/server"
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-request-body"
import { checkRateLimit, hashRedisKeyPart, rateLimitError } from "@/lib/redis/control-plane"

const archiveInput = z.object({
  siteId: z.string().uuid(),
  password: z.string().min(1).max(1024),
}).strict()

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return NextResponse.json({ error: "Expected a JSON request" }, { status: 415 })
    }

    let input: z.infer<typeof archiveInput>
    try {
      const body = await readLimitedRequestBody(request, 8192)
      input = archiveInput.parse(JSON.parse(decodeRequestBody(body)))
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof RequestBodyTooLargeError ? "Request is too large" : "A valid site ID and password are required" },
        { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
      )
    }

    const access = await requireSiteAccess(request, input.siteId, { requireManager: true })
    if (access.error) return access.error

    // A delegated owner/admin role does not authorize archiving the workspace.
    const { data: site, error: siteError } = await access.supabase
      .from("sites")
      .select("user_id, archived_at")
      .eq("id", input.siteId)
      .maybeSingle()
    if (siteError) {
      return NextResponse.json({ error: "Unable to verify site ownership" }, { status: 503 })
    }
    if (!site || site.user_id !== access.userId) {
      return NextResponse.json({ error: "Only the site owner can archive this site" }, { status: 403 })
    }
    if (site.archived_at) {
      return NextResponse.json({ error: "This site is already archived" }, { status: 409 })
    }

    const userHash = await hashRedisKeyPart(access.userId)
    const limit = await checkRateLimit(`rl:v1:site-archive:user:${userHash}`, {
      limit: 5,
      windowSeconds: 300,
      failureMode: "closed",
    })
    if (!limit.allowed) return rateLimitError(limit)
    if (!access.userEmail) {
      return NextResponse.json({ error: "An account password is required to archive a site" }, { status: 400 })
    }

    // Verify on an isolated, non-persistent client. Never replace the browser's
    // session (including its MFA assurance) with this password-only session.
    const verifier = createAuthClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    )
    const { data: verified, error: passwordError } = await verifier.auth.signInWithPassword({
      email: access.userEmail,
      password: input.password,
    })
    if (passwordError || verified.user?.id !== access.userId) {
      return NextResponse.json({ error: "Password verification failed. Check your password and try again." }, { status: 403 })
    }

    // Privileged access is created only after ownership and password checks.
    // The RPC rechecks ownership under a row lock and commits all changes together.
    const admin = await createServiceClient(true)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: archived, error: archiveError } = await admin.rpc("archive_site", {
        p_site_id: input.siteId,
        p_actor_id: access.userId,
      })
      if (!archiveError && archived === true) return NextResponse.json({ success: true })
      // Updating an existing domain locks its row before its parent-site trigger.
      // Only retry confirmed PostgreSQL transaction rollbacks, never an ambiguous
      // network failure or a mutation that may already have committed.
      if (!["40P01", "40001"].includes(archiveError?.code ?? "") || attempt === 2) break
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
    }
    return NextResponse.json({ error: "Unable to archive the site. Please try again." }, { status: 500 })
  } catch {
    // Do not log request bodies, passwords, sessions, or provider errors.
    return NextResponse.json({ error: "Unable to archive the site. Please try again." }, { status: 500 })
  }
}