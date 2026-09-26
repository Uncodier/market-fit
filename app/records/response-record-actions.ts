"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const feedbackSourceSchema = z.enum(["robots", "chat"])
const feedbackRatingSchema = z.enum(["Like", "Dislike", "Error"])

const feedbackInputSchema = z.object({
  siteId: z.string().min(1),
  source: feedbackSourceSchema,
  sourceId: z.string().min(1),
  rating: feedbackRatingSchema.nullable(),
  title: z.string().trim().min(1).max(2000),
  response: z.string().trim().min(1),
  agentId: z.string().optional(),
  instanceId: z.string().optional(),
  conversationId: z.string().optional(),
  commandId: z.string().optional(),
  messageId: z.string().optional(),
})

const createResponseRecordSchema = z.object({
  siteId: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().trim().min(1).max(2000),
  response: z.string().trim().min(1),
  relations: z.record(z.string(), z.string()).default({}),
})

export type FeedbackRecordInput = z.infer<typeof feedbackInputSchema>
export type CreateResponseRecordInput = z.infer<typeof createResponseRecordSchema>

type ActionResult = { success: true; recordId?: string } | { success: false; error: string }
export type ResponseRecordCategory = {
  id: string
  name: string
  template_fields: Array<{
    id?: string
    name: string
    type: string
    relationTarget?: string
  }>
}

const FEEDBACK_CATEGORY_KEY = "ai-feedback"
const FEEDBACK_TEMPLATE_FIELDS = [
  {
    id: "ai-feedback-rating",
    name: "Rating",
    type: "select",
    options: ["Like", "Dislike", "Error"],
  },
  {
    id: "ai-feedback-source",
    name: "Source",
    type: "select",
    options: ["Robots", "Chat"],
  },
]

async function authorizeSite(siteId: string) {
  const userClient = await createClient()
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user) throw new Error("Not authenticated")

  const admin = await createServiceClient()
  const { data: site, error: siteError } = await admin
    .from("sites")
    .select("user_id")
    .eq("id", siteId)
    .maybeSingle()
  if (siteError || !site) throw new Error("Site not found")

  if (site.user_id !== user.id) {
    const [{ data: ownership }, { data: membership }] = await Promise.all([
      admin
        .from("site_ownership")
        .select("user_id")
        .eq("site_id", siteId)
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("site_members")
        .select("user_id")
        .eq("site_id", siteId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
    ])
    if (!ownership && !membership) throw new Error("Site access denied")
  }

  return { admin, userId: user.id }
}

function feedbackDescription(input: FeedbackRecordInput) {
  const sourceLabel = input.source === "robots" ? "Robots" : "Chat"
  return `Rating: ${input.rating}\nSource: ${sourceLabel}\n\n${input.response}`
}

function feedbackRecordError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null
  if (code === "PGRST204" || code === "42703" || code === "42P10") {
    return "AI feedback records are unavailable. Ask an administrator to verify migration 20260926075940_restore_ai_feedback_record_keys and the database schema cache."
  }
  return error instanceof Error ? error.message : "Could not save feedback record"
}

export async function getResponseRecordCategories(
  siteId: string
): Promise<{ categories: ResponseRecordCategory[]; error?: string }> {
  try {
    const parsedSiteId = z.string().min(1).parse(siteId)
    const { admin } = await authorizeSite(parsedSiteId)
    const { data, error } = await admin
      .from("record_categories")
      .select("id, name, template_fields")
      .eq("site_id", parsedSiteId)
      .order("name", { ascending: true })
    if (error) throw error
    return { categories: (data || []) as ResponseRecordCategory[] }
  } catch (error) {
    console.error("[getResponseRecordCategories]", error)
    return { categories: [], error: error instanceof Error ? error.message : "Could not load categories" }
  }
}

export async function syncAiFeedbackRecord(rawInput: FeedbackRecordInput): Promise<ActionResult> {
  try {
    const input = feedbackInputSchema.parse(rawInput)
    const { admin, userId } = await authorizeSite(input.siteId)

    if (!input.rating) {
      const { error } = await admin
        .from("records")
        .delete()
        .eq("site_id", input.siteId)
        .eq("source_type", input.source)
        .eq("source_id", input.sourceId)
      if (error) throw error
      revalidatePath("/records")
      return { success: true }
    }

    const { data: category, error: categoryError } = await admin
      .from("record_categories")
      .upsert(
        {
          site_id: input.siteId,
          system_key: FEEDBACK_CATEGORY_KEY,
          name: "AI Feedback",
          description: "Examples of rated AI responses available to agent memories.",
          template_fields: FEEDBACK_TEMPLATE_FIELDS,
        },
        { onConflict: "site_id,system_key" }
      )
      .select("id")
      .single()
    if (categoryError || !category) throw categoryError || new Error("Could not create feedback category")

    const sourceLabel = input.source === "robots" ? "Robots" : "Chat"
    const { data: record, error: recordError } = await admin
      .from("records")
      .upsert(
        {
          site_id: input.siteId,
          category_id: category.id,
          source_type: input.source,
          source_id: input.sourceId,
          title: input.title,
          description: feedbackDescription(input),
          status: "active",
          relations: {},
          data: {
            Rating: input.rating,
            Source: sourceLabel,
            agent_id: input.agentId || null,
            instance_id: input.instanceId || null,
            conversation_id: input.conversationId || null,
            command_id: input.commandId || null,
            message_id: input.messageId || null,
            feedback_by: userId,
          },
        },
        { onConflict: "site_id,source_type,source_id" }
      )
      .select("id")
      .single()
    if (recordError || !record) throw recordError || new Error("Could not save feedback record")

    revalidatePath("/records")
    return { success: true, recordId: record.id }
  } catch (error) {
    console.error("[syncAiFeedbackRecord]", error)
    return { success: false, error: feedbackRecordError(error) }
  }
}

export async function createResponseRecord(rawInput: CreateResponseRecordInput): Promise<ActionResult> {
  try {
    const input = createResponseRecordSchema.parse(rawInput)
    const { admin } = await authorizeSite(input.siteId)
    const { data: category, error: categoryError } = await admin
      .from("record_categories")
      .select("id")
      .eq("id", input.categoryId)
      .eq("site_id", input.siteId)
      .maybeSingle()
    if (categoryError || !category) throw new Error("Category not found for this site")

    const { data: record, error } = await admin
      .from("records")
      .insert({
        site_id: input.siteId,
        category_id: input.categoryId,
        title: input.title,
        description: input.response,
        relations: input.relations,
        data: {},
        status: "draft",
      })
      .select("id")
      .single()
    if (error || !record) throw error || new Error("Could not create record")

    revalidatePath("/records")
    return { success: true, recordId: record.id }
  } catch (error) {
    console.error("[createResponseRecord]", error)
    return { success: false, error: error instanceof Error ? error.message : "Could not create record" }
  }
}
