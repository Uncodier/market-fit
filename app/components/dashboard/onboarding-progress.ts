import { createClient } from "@/lib/supabase/client"
import type { OnboardingTasksState } from "@/app/lib/onboarding-task-ids"

/** Keep progress writes separate from settings fields managed by license triggers. */
export async function saveOnboardingProgress(
  siteId: string,
  changes: Partial<OnboardingTasksState>
): Promise<void> {
  const supabase = createClient()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing, error: readError } = await supabase
      .from("settings")
      .select("onboarding")
      .eq("site_id", siteId)
      .maybeSingle()
    if (readError) throw readError

    const onboarding = { ...(existing?.onboarding || {}), ...changes }
    // An upsert runs INSERT triggers before conflict resolution, even for an
    // existing row. Never replay social/channel license metadata through it.
    let write = existing
      ? supabase.from("settings").update({ onboarding }).eq("site_id", siteId)
      : supabase.from("settings").insert({ site_id: siteId, onboarding })
    if (existing) {
      // Compare the JSON snapshot atomically in PostgreSQL. An overlapping
      // validator must not replace tasks completed by Skip remaining.
      write = existing.onboarding == null
        ? write.is("onboarding", null)
        : write.eq("onboarding", JSON.stringify(existing.onboarding))
    }
    const { data, error } = await write.select("onboarding").maybeSingle()

    // Another session may have initialized settings after the read. Reload its
    // progress and apply only our task changes, without retrying other failures.
    if (!existing && error?.code === "23505" && attempt === 0) continue
    if (error) throw error
    // A changed snapshot matches no row. Re-read and merge only our changes.
    if (existing && !data) continue
    if (!data) throw new Error("Onboarding progress was not saved")
    if (Object.entries(changes).some(([id, done]) => data.onboarding?.[id] !== done)) {
      throw new Error("Onboarding progress was not saved")
    }
    return
  }
  throw new Error("Onboarding progress was not saved")
}