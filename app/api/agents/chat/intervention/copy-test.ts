import type { z } from "zod"
import type { requireSiteAccess } from "@/lib/auth/api-site-access"
import { isScreenBlocked } from "@/lib/auth/screen-access"
import { readWorkspaceScreenScope } from "@/lib/permissions/workspace-screen-scope"
import { checkRateLimit } from "@/lib/redis/control-plane"
import type { copyTestSchema } from "@/app/copywriting/template-model"

type SiteAccess = Extract<Awaited<ReturnType<typeof requireSiteAccess>>, { userId: string }>

export async function admitCopyTest(access: SiteAccess, siteId: string, test: z.infer<typeof copyTestSchema>) {
  const { supabase, role, userId } = access
  if (!["owner", "admin", "collaborator"].includes(role)) return 403
  const scope = await readWorkspaceScreenScope(supabase, userId, siteId, AbortSignal.timeout(8000))
  if (scope.status !== "ready" && scope.status !== "legacy") return scope.status === "denied" ? 403 : 503
  if ((scope.status === "ready" && scope.locationRestricted) ||
      ["copywriting", "leads", "chat"].some(key => isScreenBlocked(role, scope.blockedScreens, key))) return 403
  const copy = await supabase.from("copywriting").select("id").eq("site_id", siteId).eq("id", test.copy_id).maybeSingle()
  if (copy.error || !copy.data) return copy.error ? 503 : 404
  const limit = await checkRateLimit(`copywriting:test:${siteId}`, { limit: 8, windowSeconds: 600, failureMode: "closed" })
  return limit.allowed ? 200 : limit.unavailable ? 503 : 429
}

export function copyTestMessage(test: z.infer<typeof copyTestSchema>) {
  const email = test.draft.kind === "newsletter"
  return {
    message: email ? test.draft.body : `[TEST] ${test.draft.body}`,
    recipient: email
      ? { lead_id: test.lead_id, channel: "email" as const, subject: `[TEST] ${test.draft.title}` }
      : { lead_id: test.lead_id, channel: "whatsapp" as const },
  }
}