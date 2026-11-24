"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { deleteContentRecord } from "./delete-content"
import type { DeleteContentOptions, DeleteContentResult } from "./delete-content-types"
import { isKnownDemoSite } from '@/lib/demo-data'
import { isPersistedSiteId } from '@/lib/auth/current-site-cookie'
import { readLocationRestrictionState } from '@/lib/permissions/location-boundary'
import { lookupCurrentUserSiteRole } from '@/lib/auth/site-role-lookup'

export type ContentAssetRow = {
  asset_id: string
  content_id: string
  position: number
  is_primary: boolean
  created_at: string
}

export type ContentItem = {
  id: string
  title: string
  description: string | null
  type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  content: string | null
  text: string | null
  instructions: string | null
  status: string
  segment_id: string | null
  campaign_id: string | null
  site_id: string
  author_id: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
  tags: string[] | null
  word_count: number | null
  estimated_reading_time: number | null
  seo_score: number | null
  performance_rating: number | null
  assets?: ContentAsset[]
}

export type ContentAsset = {
  id: string
  name: string
  description: string | null
  file_path: string
  file_type: string
  file_size: number | null
  position: number
  is_primary: boolean
}

export interface ContentResponse {
  content: ContentItem[] | null
  error: string | null
  count: number
}

export async function getContent(siteId: string): Promise<ContentResponse> {
  const failure = (error: string): ContentResponse => ({ content: null, error, count: 0 })
  try {
    if (typeof siteId !== 'string' || !isPersistedSiteId(siteId)) return failure('Invalid workspace')
    const demo = isKnownDemoSite(siteId)
    const supabase = await createClient(!demo)
    if (demo !== (supabase._isDemo === true) || (siteId.startsWith('demo-') && !demo)) return failure('Forbidden')
    if (!demo) {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user || user.is_anonymous) return failure(error && (error.status ?? 0) >= 500 ? 'Content unavailable' : 'Not authenticated')
      // Same unscoped boundary as before, with explicit effective membership.
      // The actual list still runs with this caller's RLS, not a service key.
      const [role, restricted] = await Promise.all([lookupCurrentUserSiteRole(supabase, siteId), readLocationRestrictionState(supabase)])
      if (restricted === null) return failure('Content unavailable')
      if (restricted || !['owner', 'admin', 'collaborator', 'marketing'].includes(role ?? '')) return failure('Forbidden')
    }
    const { data, error, count } = await supabase.from('content').select('*', { count: 'exact' })
      .eq('site_id', siteId).order('created_at', { ascending: false })
    if (error || !Array.isArray(data)) return failure(error?.code === '42501' ? 'Forbidden' : 'Failed to load content items')
    return { content: data as ContentItem[], error: null, count: count ?? data.length }
  } catch { return failure('Content unavailable') }
}

export async function createContent({
  siteId,
  title,
  description,
  type,
  segment_id,
  campaign_id,
  tags,
  text,
  status = 'draft'
}: {
  siteId: string
  title: string
  description?: string
  type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  segment_id?: string | null
  campaign_id?: string | null
  tags?: string[] | null
  text?: string
  status?: string
}) {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('content')
      .insert({
        site_id: siteId,
        title,
        description,
        type,
        segment_id,
        campaign_id,
        tags,
        text,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error("Error creating content:", error)
      return { error: error.message }
    }
    
    revalidatePath("/content")
    return { content: data }
  } catch (error) {
    console.error("Error creating content:", error)
    return { error: "Failed to create content" }
  }
}

export async function updateContentStatus(data: {
  contentId: string
  status: "draft" | "review" | "approved" | "published" | "archived"
}) {
  try {
    const supabase = await createServiceClient()

    const { error } = await supabase
      .from("content")
      .update({ 
        status: data.status,
        updated_at: new Date().toISOString(),
        ...(data.status === "published" ? { published_at: new Date().toISOString() } : {})
      })
      .eq("id", data.contentId)

    if (error) {
      console.error("Error updating content status:", error)
      return { error: error.message }
    }

    revalidatePath("/content")
    return { success: true }
  } catch (error) {
    console.error("Error in updateContentStatus:", error)
    return { error: "Failed to update content status" }
  }
}

export async function updateContent({
  contentId,
  title,
  description,
  type,
  segment_id,
  campaign_id,
  tags,
  text,
  instructions,
  performance_rating,
  skipRevalidation
}: {
  contentId: string
  title: string
  description?: string
  type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
  segment_id?: string | null
  campaign_id?: string | null
  tags?: string[] | null
  content?: string
  text?: string
  instructions?: string
  performance_rating?: number | null
  skipRevalidation?: boolean
}) {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('content')
      .update({
        title,
        description,
        type,
        segment_id,
        campaign_id,
        tags,
        text,
        instructions,
        performance_rating,
        updated_at: new Date().toISOString()
      })
      .eq('id', contentId)
      .select()
      .single()
    
    if (error) {
      console.error("Error updating content:", error)
      return { error: error.message }
    }
    
    // Only revalidate if not specifically skipped (for rating updates)
    if (!skipRevalidation) {
      revalidatePath("/content")
    }
    
    return { content: data }
  } catch (error) {
    console.error("Error updating content:", error)
    return { error: "Failed to update content" }
  }
}

export async function getContentById(contentId: string): Promise<{ content: ContentItem | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single()
    
    if (error) {
      console.error("Error fetching content:", error)
      return { content: null, error: error.message }
    }
    
    return { content: data as ContentItem, error: null }
  } catch (error) {
    console.error("Error in getContentById:", error)
    return { content: null, error: "Failed to fetch content" }
  }
}

export async function deleteContent(
  contentId: string, options: DeleteContentOptions = {},
): Promise<DeleteContentResult> {
  return deleteContentRecord(contentId, options)
}