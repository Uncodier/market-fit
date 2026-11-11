"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type TrashItem = {
  id: string
  kind: "record" | "category"
  title: string
  deleted_at: string
  category_id?: string | null
  deletion_batch_id?: string | null
  deletion_root_category_id?: string | null
  parent_category_id?: string | null
}

function trashError(error: { message?: string; code?: string }): string {
  const messages: Record<string, string> = {
    "Restore the deleted root category first": "Restore the containing collection from Trash first.",
    "Restore the parent category first": "Restore the parent collection before restoring this record.",
    "System record categories cannot be trashed": "System collections cannot be moved to Trash.",
    "Manage system feedback from its source UI": "Manage this AI feedback record from the conversation or robot where it was created.",
    "Records trash access denied": "Only an authorized workspace manager can manage collection Trash.",
    "Record not found or access denied": "Record not found or access denied.",
  }
  return messages[error.message || ""] || "Unable to change Trash. Check permissions, parent collection and database migration readiness."
}

async function authenticatedClient() {
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error("Not authenticated")
  return client
}

async function mutate(rpc: string, key: string, id: string) {
  try {
    const parsed = z.string().uuid().parse(id)
    const client = await authenticatedClient()
    const { error } = await client.rpc(rpc, { [key]: parsed })
    if (error) return { error: trashError(error) }
    revalidatePath("/records")
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error && error.message === "Not authenticated" ? error.message : "Invalid Trash request" }
  }
}

export async function moveRecordToTrash(id: string) {
  return mutate("trash_record", "p_record_id", id)
}

export async function moveCategoryToTrash(id: string) {
  return mutate("trash_record_category", "p_category_id", id)
}

export async function restoreRecord(id: string) {
  return mutate("restore_record", "p_record_id", id)
}

export async function restoreRecordCategory(id: string) {
  return mutate("restore_record_category", "p_category_id", id)
}

export async function getRecordTrash(siteId: string): Promise<{ items: TrashItem[] | null; error: string | null }> {
  try {
    const parsed = z.string().uuid().parse(siteId)
    const client = await authenticatedClient()
    const { data, error } = await client.rpc("list_record_trash", { p_site_id: parsed })
    if (error) return { items: null, error: "Unable to load Trash. Manager access and the Trash migration are required." }
    return { items: data as TrashItem[], error: null }
  } catch {
    return { items: null, error: "Unable to load Trash" }
  }
}