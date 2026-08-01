"use server"

import { createClient } from "@/lib/supabase/server"

export async function saveCourseProgress(entitlementId: string, progress: { lastIndex: number, completedIndexes: number[] }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in" }
  
  // Verify entitlement belongs to user
  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('buyer_user_id, metadata')
    .eq('id', entitlementId)
    .single()
    
  if (!entitlement || entitlement.buyer_user_id !== user.id) return { error: "Not authorized" }
  
  const metadata = entitlement.metadata || {}
  
  const { error } = await supabase
    .from('entitlements')
    .update({
      metadata: {
        ...metadata,
        course_progress: {
          ...progress,
          updatedAt: new Date().toISOString()
        }
      }
    })
    .eq('id', entitlementId)
    
  if (error) return { error: error.message }
  return { success: true }
}