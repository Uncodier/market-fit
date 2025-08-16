"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface CopywritingItem {
  id: string
  title: string
  description?: string
  content?: string
  type: 'tweet' | 'pitch' | 'blurb' | 'cold_email' | 'cold_call' | 'social_post' | 'ad_copy' | 'headline' | 'description' | 'landing_page'
  status: 'pending' | 'in_progress' | 'completed' | 'published' | 'archived'
  segment_id?: string
  campaign_id?: string
  site_id: string
  created_at: string
  updated_at: string
  rating?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export async function getCopywriting(siteId: string): Promise<CopywritingItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('copywriting')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching copywriting:', error)
    throw new Error('Failed to fetch copywriting items')
  }

  return data || []
}

export async function createCopywriting(
  siteId: string, 
  copywritingData: Partial<CopywritingItem>
): Promise<CopywritingItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('copywriting')
    .insert({
      ...copywritingData,
      site_id: siteId,
      status: copywritingData.status || 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating copywriting:', error)
    throw new Error('Failed to create copywriting item')
  }

  revalidatePath('/copywriting')
  return data
}

export async function updateCopywriting(
  id: string, 
  updates: Partial<CopywritingItem>
): Promise<CopywritingItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('copywriting')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating copywriting:', error)
    throw new Error('Failed to update copywriting item')
  }

  revalidatePath('/copywriting')
  return data
}

export async function updateCopywritingStatus(
  id: string, 
  status: CopywritingItem['status']
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('copywriting')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating copywriting status:', error)
    throw new Error('Failed to update copywriting status')
  }

  revalidatePath('/copywriting')
}

export async function deleteCopywriting(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('copywriting')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting copywriting:', error)
    throw new Error('Failed to delete copywriting item')
  }

  revalidatePath('/copywriting')
}

export async function getCopywritingById(id: string): Promise<CopywritingItem | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('copywriting')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching copywriting by id:', error)
    return null
  }

  return data
}

export async function updateCopywritingRating(
  id: string, 
  rating: number
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('copywriting')
    .update({ 
      rating,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating copywriting rating:', error)
    throw new Error('Failed to update copywriting rating')
  }

  revalidatePath('/copywriting')
}

export async function getCopywritingByType(
  siteId: string, 
  type: CopywritingItem['type']
): Promise<CopywritingItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('copywriting')
    .select('*')
    .eq('site_id', siteId)
    .eq('type', type)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching copywriting by type:', error)
    throw new Error('Failed to fetch copywriting items by type')
  }

  return data || []
}

export async function getCopywritingByStatus(
  siteId: string, 
  status: CopywritingItem['status']
): Promise<CopywritingItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('copywriting')
    .select('*')
    .eq('site_id', siteId)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching copywriting by status:', error)
    throw new Error('Failed to fetch copywriting items by status')
  }

  return data || []
}
