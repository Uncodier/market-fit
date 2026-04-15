'use server'

import { createClient } from '@/lib/supabase/server'
import { 
  InstanceNode, 
  CreateInstanceNodeParams, 
  UpdateInstanceNodeParams 
} from '@/app/types/instance-nodes'

/**
 * Creates a new instance node. If site_id is not provided, it will be fetched from the remote_instance.
 */
export async function createInstanceNode(params: CreateInstanceNodeParams): Promise<{ data: InstanceNode | null; error: any }> {
  const supabase = await createClient()

  // Verify auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { data: null, error: new Error('Unauthorized') }
  }

  // Get site_id if not provided
  let site_id = params.site_id
  if (!site_id) {
    const { data: instance, error: instanceError } = await supabase
      .from('remote_instances')
      .select('site_id')
      .eq('id', params.instance_id)
      .single()

    if (instanceError || !instance) {
      return { data: null, error: new Error('Instance not found or unauthorized') }
    }
    site_id = instance.site_id
  }

  const nodeData = {
    instance_id: params.instance_id,
    parent_node_id: params.parent_node_id || null,
    original_node_id: params.original_node_id || null,
    parent_instance_log_id: params.parent_instance_log_id || null,
    type: params.type,
    status: params.status || 'pending',
    result: params.result || {},
    settings: params.settings || {},
    prompt: params.prompt || {},
    site_id: site_id,
    user_id: user.id
  }

  const { data, error } = await supabase
    .from('instance_nodes')
    .insert(nodeData)
    .select()
    .single()

  return { data, error }
}

export async function updateInstanceNode(id: string, params: UpdateInstanceNodeParams): Promise<{ data: InstanceNode | null; error: any }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instance_nodes')
    .update(params)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

export async function deleteInstanceNode(id: string): Promise<{ success: boolean; error: any }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('instance_nodes')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error }
  }

  return { success: true, error: null }
}

export async function getInstanceNodes(instanceId: string): Promise<{ data: InstanceNode[] | null; error: any }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instance_nodes')
    .select('*')
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  return { data, error }
}

export async function getInstanceNodeById(id: string): Promise<{ data: InstanceNode | null; error: any }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instance_nodes')
    .select('*')
    .eq('id', id)
    .single()

  return { data, error }
}
