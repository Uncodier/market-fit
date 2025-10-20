import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/use-toast'
import { InstanceAsset } from '../types'

interface UseInstanceAssetsProps {
  instanceId?: string
}

export const useInstanceAssets = ({ instanceId }: UseInstanceAssetsProps) => {
  const [assets, setAssets] = useState<InstanceAsset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Fetch assets for the instance
  const fetchAssets = async () => {
    if (!instanceId) {
      console.log('🔄 No instanceId, clearing assets')
      setAssets([])
      return
    }

    console.log('🔄 Fetching assets for instance:', instanceId)
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching assets:', error)
        toast({
          title: 'Error',
          description: 'Failed to load assets',
          variant: 'destructive'
        })
        return
      }

      console.log('🔄 Assets fetched:', data?.length || 0, 'assets')
      setAssets(data || [])
    } catch (error) {
      console.error('Error fetching assets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load assets',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete asset
  const deleteAsset = async (assetId: string) => {
    try {
      const supabase = createClient()
      
      // Get asset info before deletion
      const asset = assets.find(a => a.id === assetId)
      if (!asset) return

      // Delete from storage first
      // Extract the storage path from the full URL
      const urlParts = asset.file_path.split('/')
      const storagePath = urlParts[urlParts.length - 2] + '/' + urlParts[urlParts.length - 1]
      const { error: storageError } = await supabase
        .storage
        .from('assets')
        .remove([storagePath])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId)

      if (dbError) {
        console.error('Error deleting asset from database:', dbError)
        toast({
          title: 'Error',
          description: 'Failed to delete asset',
          variant: 'destructive'
        })
        return
      }

      // Remove from local state
      setAssets(prev => prev.filter(a => a.id !== assetId))
      
      toast({
        title: 'Success',
        description: 'Asset deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting asset:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete asset',
        variant: 'destructive'
      })
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    if (!instanceId) return

    const supabase = createClient()
    
    // Initial fetch
    fetchAssets()

    // Set up real-time subscription
    const channel = supabase
      .channel(`instance-assets-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assets',
          filter: `instance_id=eq.${instanceId}`
        },
        (payload) => {
          console.log('Asset change detected:', payload)
          // Refetch assets to ensure consistency
          fetchAssets()
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [instanceId])

  return {
    assets,
    isLoading,
    deleteAsset,
    refetchAssets: fetchAssets
  }
}




