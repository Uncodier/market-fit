import { createClient } from "@/lib/supabase/client"
import { readProfile } from "./editor-profile"

export async function loadEditorProfile(siteId: string, agentId: string, signal: AbortSignal) {
  const supabase = createClient()
  const { data: row, error } = await supabase.from("agents")
    .select("id, site_id, supervisor, role, name, description, status, type, prompt, backstory, tools, integrations, configuration, activities")
    .eq("site_id", siteId).eq("id", agentId).abortSignal(signal).single()
  if (signal.aborted || error || !row || row.site_id !== siteId || row.id !== agentId) {
    throw new Error("Agent not found or unavailable for this site")
  }

  const profile = readProfile(row)
  const { data: links, error: assetError } = await supabase.from("agent_assets")
    .select("assets:asset_id (id, name, file_path)").eq("agent_id", row.id).abortSignal(signal)
  if (assetError) {
    if (!signal.aborted) console.error("Error loading agent assets")
    profile.contextFiles = []
  } else if (links?.length) {
    // An RLS-invisible/deleted joined asset can be null.
    profile.contextFiles = links.flatMap(({ assets }: { assets: { id: string; name: string; file_path: string } | null }) =>
      assets ? [{ id: assets.id, name: assets.name, path: assets.file_path }] : [])
  }
  return profile
}