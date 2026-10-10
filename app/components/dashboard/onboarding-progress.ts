import { createClient } from "@/lib/supabase/client"
import type { OnboardingTasksState } from "@/app/lib/onboarding-task-ids"

/** Keep progress writes separate from settings fields managed by license triggers. */
export async function saveOnboardingProgress(
  siteId: string,
  changes: Partial<OnboardingTasksState>
): Promise<void> {
  const supabase = createClient()
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: readError } = await supabase
      .from("settings")
      .select("onboarding")
      .eq("site_id", siteId)
      .maybeSingle()
    if (readError) throw readError

    const onboarding = { ...(existing?.onboarding || {}), ...changes }
    // An upsert runs INSERT triggers before conflict resolution, even for an
    // existing row. Never replay social/channel license metadata through it.
    const write = existing
      ? supabase.from("settings").update({ onboarding }).eq("site_id", siteId)
      : supabase.from("settings").insert({ site_id: siteId, onboarding })
    const { data, error } = await write.select("onboarding").single()

    // Another session may have initialized settings after the read. Reload its
    // progress and apply only our task changes, without retrying other failures.
    if (!existing && error?.code === "23505" && attempt === 0) continue
    if (error) throw error
    if (!data) throw new Error("Onboarding progress was not saved")
    return
  }
}