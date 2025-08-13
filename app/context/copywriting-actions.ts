import { createClient } from "@/lib/supabase/client"
import { type CopywritingItem } from "../components/settings/form-schema"

export interface CopywritingActions {
  createCopywritingItem: (siteId: string, userId: string, item: CopywritingItem) => Promise<{ success: boolean; error?: string; data?: any }>
  updateCopywritingItem: (id: string, item: Partial<CopywritingItem>) => Promise<{ success: boolean; error?: string }>
  deleteCopywritingItem: (id: string) => Promise<{ success: boolean; error?: string }>
  getCopywritingItems: (siteId: string) => Promise<{ success: boolean; data?: CopywritingItem[]; error?: string }>
  syncCopywritingItems: (siteId: string, userId: string, items: CopywritingItem[]) => Promise<{ success: boolean; error?: string }>
}

class CopywritingService implements CopywritingActions {
  private supabase = createClient()

  async createCopywritingItem(siteId: string, userId: string, item: CopywritingItem) {
    try {
      const { data, error } = await this.supabase
        .from('copywriting')
        .insert({
          site_id: siteId,
          user_id: userId,
          title: item.title,
          content: item.content,
          copy_type: item.copy_type,
          target_audience: item.target_audience || null,
          use_case: item.use_case || null,
          notes: item.notes || null,
          tags: item.tags || [],
          status: item.status || 'draft'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating copywriting item:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      console.error('Exception creating copywriting item:', error)
      return { success: false, error: 'Failed to create copywriting item' }
    }
  }

  async updateCopywritingItem(id: string, item: Partial<CopywritingItem>) {
    try {
      const updateData: any = {}
      
      if (item.title !== undefined) updateData.title = item.title
      if (item.content !== undefined) updateData.content = item.content
      if (item.copy_type !== undefined) updateData.copy_type = item.copy_type
      if (item.target_audience !== undefined) updateData.target_audience = item.target_audience || null
      if (item.use_case !== undefined) updateData.use_case = item.use_case || null
      if (item.notes !== undefined) updateData.notes = item.notes || null
      if (item.tags !== undefined) updateData.tags = item.tags || []
      if (item.status !== undefined) updateData.status = item.status || 'draft'

      const { error } = await this.supabase
        .from('copywriting')
        .update(updateData)
        .eq('id', id)

      if (error) {
        console.error('Error updating copywriting item:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Exception updating copywriting item:', error)
      return { success: false, error: 'Failed to update copywriting item' }
    }
  }

  async deleteCopywritingItem(id: string) {
    try {
      const { error } = await this.supabase
        .from('copywriting')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting copywriting item:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Exception deleting copywriting item:', error)
      return { success: false, error: 'Failed to delete copywriting item' }
    }
  }

  async getCopywritingItems(siteId: string) {
    try {
      const { data, error } = await this.supabase
        .from('copywriting')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching copywriting items:', error)
        return { success: false, error: error.message }
      }

      // Transform database records to match CopywritingItem interface
      const items: CopywritingItem[] = (data || []).map(record => ({
        id: record.id,
        title: record.title,
        content: record.content,
        copy_type: record.copy_type,
        target_audience: record.target_audience || undefined,
        use_case: record.use_case || undefined,
        notes: record.notes || undefined,
        tags: record.tags || [],
        status: record.status || 'draft'
      }))

      return { success: true, data: items }
    } catch (error) {
      console.error('Exception fetching copywriting items:', error)
      return { success: false, error: 'Failed to fetch copywriting items' }
    }
  }

  async syncCopywritingItems(siteId: string, userId: string, items: CopywritingItem[]) {
    try {
      console.log('COPYWRITING SYNC: Starting sync for site:', siteId)
      console.log('COPYWRITING SYNC: Items to sync:', items.length)

      // Get existing items from database
      const { data: existingItems, error: fetchError } = await this.supabase
        .from('copywriting')
        .select('*')
        .eq('site_id', siteId)

      if (fetchError) {
        console.error('COPYWRITING SYNC: Error fetching existing items:', fetchError)
        return { success: false, error: fetchError.message }
      }

      console.log('COPYWRITING SYNC: Existing items in DB:', existingItems?.length || 0)

      const existingMap = new Map(existingItems?.map(item => [item.id, item]) || [])
      const newItems: CopywritingItem[] = []
      const updateItems: Array<{ id: string; item: CopywritingItem }> = []
      const keepIds = new Set<string>()

      // Process each item from the form
      for (const item of items) {
        // Skip empty items (title or content missing)
        if (!item.title?.trim() || !item.content?.trim()) {
          console.log('COPYWRITING SYNC: Skipping empty item:', { title: item.title, content: !!item.content })
          continue
        }

        if (item.id && existingMap.has(item.id)) {
          // Update existing item
          updateItems.push({ id: item.id, item })
          keepIds.add(item.id)
        } else {
          // Create new item
          newItems.push(item)
        }
      }

      console.log('COPYWRITING SYNC: New items to create:', newItems.length)
      console.log('COPYWRITING SYNC: Items to update:', updateItems.length)

      // Create new items
      if (newItems.length > 0) {
        const insertData = newItems.map(item => ({
          site_id: siteId,
          user_id: userId,
          title: item.title,
          content: item.content,
          copy_type: item.copy_type,
          target_audience: item.target_audience || null,
          use_case: item.use_case || null,
          notes: item.notes || null,
          tags: item.tags || [],
          status: item.status || 'draft'
        }))

        const { error: insertError } = await this.supabase
          .from('copywriting')
          .insert(insertData)

        if (insertError) {
          console.error('COPYWRITING SYNC: Error creating new items:', insertError)
          return { success: false, error: insertError.message }
        }

        console.log('COPYWRITING SYNC: Successfully created new items')
      }

      // Update existing items
      for (const { id, item } of updateItems) {
        const updateData = {
          title: item.title,
          content: item.content,
          copy_type: item.copy_type,
          target_audience: item.target_audience || null,
          use_case: item.use_case || null,
          notes: item.notes || null,
          tags: item.tags || [],
          status: item.status || 'draft',
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await this.supabase
          .from('copywriting')
          .update(updateData)
          .eq('id', id)

        if (updateError) {
          console.error('COPYWRITING SYNC: Error updating item:', id, updateError)
          return { success: false, error: updateError.message }
        }
      }

      console.log('COPYWRITING SYNC: Successfully updated existing items')

      // Delete items that are no longer in the form
      const itemsToDelete = existingItems?.filter(item => !keepIds.has(item.id)) || []
      
      if (itemsToDelete.length > 0) {
        console.log('COPYWRITING SYNC: Items to delete:', itemsToDelete.length)
        
        const { error: deleteError } = await this.supabase
          .from('copywriting')
          .delete()
          .in('id', itemsToDelete.map(item => item.id))

        if (deleteError) {
          console.error('COPYWRITING SYNC: Error deleting items:', deleteError)
          return { success: false, error: deleteError.message }
        }

        console.log('COPYWRITING SYNC: Successfully deleted removed items')
      }

      console.log('COPYWRITING SYNC: Sync completed successfully')
      return { success: true }

    } catch (error) {
      console.error('COPYWRITING SYNC: Exception during sync:', error)
      return { success: false, error: 'Failed to sync copywriting items' }
    }
  }
}

export const copywritingService = new CopywritingService()
