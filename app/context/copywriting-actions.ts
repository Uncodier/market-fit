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
      console.log('COPYWRITING SYNC: Starting sync for site:', siteId, 'user:', userId)
      console.log('COPYWRITING SYNC: Items to sync:', items.length)
      console.log('COPYWRITING SYNC: Items data:', JSON.stringify(items, null, 2))

      if (!siteId || !userId) {
        console.error('COPYWRITING SYNC: Missing required parameters', { siteId, userId })
        return { success: false, error: 'Missing siteId or userId' }
      }

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

      // Create maps for efficient lookup
      const existingMapById = new Map(existingItems?.map(item => [item.id, item]) || [])
      // Map by (site_id, user_id, title) to handle items without IDs or title changes
      const existingMapByTitle = new Map(
        existingItems?.map(item => [`${item.site_id}_${item.user_id}_${item.title?.trim() || ''}`, item]) || []
      )
      
      const newItems: CopywritingItem[] = []
      const updateItems: Array<{ id: string; item: CopywritingItem }> = []
      const keepIds = new Set<string>()

      // Process each item from the form
      for (const item of items) {
        // More lenient check - only skip if both title and content are completely empty
        const hasTitle = item.title && item.title.trim().length > 0
        const hasContent = item.content && item.content.trim().length > 0
        const isEmpty = !hasTitle && !hasContent

        // Check if item has an ID and exists in DB
        const isExistingById = item.id && existingMapById.has(item.id)
        
        // Check if item exists by title (for items without ID or when title might have changed)
        const titleKey = `${siteId}_${userId}_${item.title?.trim() || ''}`
        const existingByTitle = existingMapByTitle.get(titleKey)

        console.log('COPYWRITING SYNC: Processing item:', {
          id: item.id,
          title: item.title,
          hasTitle,
          hasContent,
          isEmpty,
          isExistingById,
          existingByTitleId: existingByTitle?.id,
          copy_type: item.copy_type
        })

        if (isExistingById) {
          // Item exists in DB by ID - preserve it even if temporarily empty
          keepIds.add(item.id!)
          
          // Check if title changed and would cause a duplicate
          const existingItem = existingMapById.get(item.id!)
          if (existingItem && existingItem.title !== item.title?.trim()) {
            // Title changed - check if new title already exists
            const newTitleKey = `${siteId}_${userId}_${item.title?.trim() || ''}`
            const existingWithNewTitle = existingMapByTitle.get(newTitleKey)
            
            if (existingWithNewTitle && existingWithNewTitle.id !== item.id) {
              // New title already exists for a different item - this would cause a duplicate
              console.error('COPYWRITING SYNC: Cannot update - new title already exists:', {
                currentId: item.id,
                existingId: existingWithNewTitle.id,
                newTitle: item.title
              })
              return { 
                success: false, 
                error: `A copywriting item with the title "${item.title}" already exists. Please use a different title.` 
              }
            }
          }
          
          if (isEmpty) {
            // Item exists but is empty - preserve it, don't update
            console.log('COPYWRITING SYNC: Preserving existing item (empty in form):', { id: item.id, title: item.title || 'empty' })
          } else {
            // Item exists and has content - update it
            updateItems.push({ id: item.id!, item })
            console.log('COPYWRITING SYNC: Updating existing item:', { id: item.id, title: item.title })
          }
        } else if (existingByTitle && hasTitle) {
          // Item doesn't have ID but exists by title - update the existing one
          console.log('COPYWRITING SYNC: Item exists by title, updating instead of creating:', {
            existingId: existingByTitle.id,
            title: item.title
          })
          keepIds.add(existingByTitle.id)
          
          if (isEmpty) {
            console.log('COPYWRITING SYNC: Preserving existing item (empty in form):', { id: existingByTitle.id, title: item.title || 'empty' })
          } else {
            updateItems.push({ id: existingByTitle.id, item })
            console.log('COPYWRITING SYNC: Updating existing item by title:', { id: existingByTitle.id, title: item.title })
          }
        } else {
          // New item (no ID and doesn't exist by title)
          if (isEmpty) {
            // Skip empty new items - don't create them
            console.log('COPYWRITING SYNC: Skipping empty new item (will not be created):', { title: item.title || 'empty', content: item.content || 'empty' })
            continue
          } else {
            // Create new item with content
            // Ensure we have at least a title or content
            if (!hasTitle && !hasContent) {
              console.log('COPYWRITING SYNC: Skipping item with no title or content')
              continue
            }
            
            // Double-check that this title doesn't already exist (race condition protection)
            if (hasTitle && existingMapByTitle.has(titleKey)) {
              console.log('COPYWRITING SYNC: Title already exists, updating instead of creating:', { title: item.title })
              const existingItem = existingMapByTitle.get(titleKey)!
              keepIds.add(existingItem.id)
              updateItems.push({ id: existingItem.id, item })
            } else {
              newItems.push(item)
              console.log('COPYWRITING SYNC: Creating new item:', { title: item.title, content: item.content?.substring(0, 50) + '...' })
            }
          }
        }
      }

      console.log('COPYWRITING SYNC: New items to create:', newItems.length)
      console.log('COPYWRITING SYNC: Items to update:', updateItems.length)

      // Create new items
      if (newItems.length > 0) {
        const insertData = newItems.map(item => ({
          site_id: siteId,
          user_id: userId,
          title: item.title || 'Untitled',
          content: item.content || '',
          copy_type: item.copy_type,
          target_audience: item.target_audience || null,
          use_case: item.use_case || null,
          notes: item.notes || null,
          tags: item.tags || [],
          status: item.status || 'draft'
        }))

        console.log('COPYWRITING SYNC: Insert data prepared:', JSON.stringify(insertData, null, 2))

        const { data: insertedData, error: insertError } = await this.supabase
          .from('copywriting')
          .insert(insertData)
          .select()

        if (insertError) {
          console.error('COPYWRITING SYNC: Error creating new items:', insertError)
          console.error('COPYWRITING SYNC: Insert error details:', JSON.stringify(insertError, null, 2))
          return { success: false, error: insertError.message }
        }

        console.log('COPYWRITING SYNC: Successfully created new items:', insertedData?.length || 0)
        if (insertedData && insertedData.length > 0) {
          console.log('COPYWRITING SYNC: Inserted items IDs:', insertedData.map(item => item.id))
        }
      } else {
        console.log('COPYWRITING SYNC: No new items to create')
      }

      // Update existing items
      if (updateItems.length > 0) {
        for (const { id, item } of updateItems) {
          const updateData = {
            title: item.title || 'Untitled',
            content: item.content || '',
            copy_type: item.copy_type,
            target_audience: item.target_audience || null,
            use_case: item.use_case || null,
            notes: item.notes || null,
            tags: item.tags || [],
            status: item.status || 'draft',
            updated_at: new Date().toISOString()
          }

          console.log('COPYWRITING SYNC: Updating item:', { id, updateData })

          const { data: updatedData, error: updateError } = await this.supabase
            .from('copywriting')
            .update(updateData)
            .eq('id', id)
            .select()

          if (updateError) {
            console.error('COPYWRITING SYNC: Error updating item:', id, updateError)
            return { success: false, error: updateError.message }
          }

          console.log('COPYWRITING SYNC: Successfully updated item:', id)
        }
        console.log('COPYWRITING SYNC: Successfully updated existing items')
      } else {
        console.log('COPYWRITING SYNC: No items to update')
      }

      // Delete items that are no longer in the form
      const itemsToDelete = existingItems?.filter(item => !keepIds.has(item.id)) || []
      
      if (itemsToDelete.length > 0) {
        console.log('COPYWRITING SYNC: Items to delete:', itemsToDelete.length)
        console.log('COPYWRITING SYNC: Items being deleted:', itemsToDelete.map(item => ({ id: item.id, title: item.title || 'Untitled' })))
        
        const { error: deleteError } = await this.supabase
          .from('copywriting')
          .delete()
          .in('id', itemsToDelete.map(item => item.id))

        if (deleteError) {
          console.error('COPYWRITING SYNC: Error deleting items:', deleteError)
          return { success: false, error: deleteError.message }
        }

        console.log('COPYWRITING SYNC: Successfully deleted removed items')
      } else {
        console.log('COPYWRITING SYNC: No items to delete - all existing items preserved')
      }

      const totalOperations = newItems.length + updateItems.length
      if (totalOperations === 0 && items.length > 0) {
        console.warn('COPYWRITING SYNC: WARNING - No operations performed but items were provided')
        console.warn('COPYWRITING SYNC: This might indicate all items were filtered out as empty')
      }

      console.log('COPYWRITING SYNC: Sync completed successfully')
      return { success: true }

    } catch (error) {
      console.error('COPYWRITING SYNC: Exception during sync:', error)
      if (error instanceof Error) {
        console.error('COPYWRITING SYNC: Error stack:', error.stack)
        return { success: false, error: error.message }
      }
      return { success: false, error: 'Failed to sync copywriting items' }
    }
  }
}

export const copywritingService = new CopywritingService()
