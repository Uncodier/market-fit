import { createClient } from '@/lib/supabase/client'
import { cloudToolDeliverables, mergeCloudDeliverables, type CloudFileActivity, type CloudDeliverable } from './cloud-tool-deliverables'

export const CLOUD_FILE_PAGE_SIZE = 500

/** Read only file receipts under the user's RLS scope, never the full chat history. */
export async function fetchCloudToolDeliverables(instanceId: string, siteId: string): Promise<CloudDeliverable[]> {
  const supabase = createClient()
  let files: CloudDeliverable[] = []
  for (let offset = 0; ; offset += CLOUD_FILE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('instance_logs')
      .select('instance_id, site_id, tool_name, tool_result, created_at')
      .eq('instance_id', instanceId)
      .eq('site_id', siteId)
      .in('tool_name', ['write_cloud_file', 'deliver_file', 'tools'])
      .not('tool_result', 'is', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + CLOUD_FILE_PAGE_SIZE - 1)
    if (error) throw new Error('Failed to load instance files')
    const receipts = (data ?? []) as CloudFileActivity[]
    files = mergeCloudDeliverables(files, cloudToolDeliverables(receipts, instanceId, siteId))
    if (receipts.length < CLOUD_FILE_PAGE_SIZE) return files
  }
}