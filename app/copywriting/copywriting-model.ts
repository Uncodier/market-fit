import { z } from "zod"

// Keep the standalone workspace aligned with the copywriting rows used in Settings.
export const COPY_TYPES = [
  "tweet", "cold_email", "cold_call", "sales_pitch", "follow_up_email",
  "nurture_email", "linkedin_message", "ad_copy", "facebook_ad", "google_ad",
  "landing_page", "email_subject", "newsletter", "blog_post", "case_study",
  "testimonial", "tagline", "slogan", "product_description", "call_to_action",
  "social_post", "instagram_post", "instagram_story", "video_script",
  "webinar_script", "press_release", "proposal", "objection_handling",
  "faq", "blurb", "other",
] as const

export const COPY_STATUSES = ["draft", "review", "approved", "published", "archived"] as const
export const COPY_TABS = ["all", "tweet", "cold_email", "sales_pitch", "ad_copy"] as const
export type CopyTab = typeof COPY_TABS[number]

export const copyFieldsSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().refine(value => value.trim().length > 0),
  copy_type: z.enum(COPY_TYPES),
  status: z.enum(COPY_STATUSES),
  target_audience: z.string().trim(),
  use_case: z.string().trim(),
  notes: z.string().trim(),
}).strict()

export type CopyFields = z.infer<typeof copyFieldsSchema>
export type CopywritingItem = Omit<CopyFields, "target_audience" | "use_case" | "notes" | "status"> & {
  id: string
  status: CopyFields["status"] | null
  target_audience: string | null
  use_case: string | null
  notes: string | null
}

export function initialCopyFields(item?: CopywritingItem, tab: CopyTab = "all"): CopyFields {
  return {
    title: item?.title ?? "",
    content: item?.content ?? "",
    copy_type: item?.copy_type ?? (tab === "all" ? "other" : tab),
    status: item?.status ?? "draft",
    target_audience: item?.target_audience ?? "",
    use_case: item?.use_case ?? "",
    notes: item?.notes ?? "",
  }
}