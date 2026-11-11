import type { SupabaseClient } from "@supabase/supabase-js"
import type { ValidatedTemplateField } from "./template-validation"

/** Category bindings are configuration, but still require same-site readable targets. */
export async function validateTemplateTargets(
  supabase: SupabaseClient,
  siteId: string,
  fields: ValidatedTemplateField[],
): Promise<void> {
  const ids = [...new Set(fields.flatMap(field => field.targetCategoryId ? [field.targetCategoryId] : []))]
  if (!ids.length) return
  const { data, error } = await supabase.from("record_categories")
    .select("id").eq("site_id", siteId).in("id", ids)
  if (error || !data || new Set(data.map(row => row.id)).size !== ids.length) {
    throw new Error("Related categories must exist and be readable in this site")
  }
}