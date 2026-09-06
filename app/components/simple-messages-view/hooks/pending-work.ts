import { createClient } from '@/lib/supabase/client'
import { contextService, type SelectedContextIds } from '@/app/services/context-service'
import { ImageParameters, VideoParameters, AudioParameters } from '../types'
import { getSystemPromptForActivity } from '../utils'

export type PendingWorkStatus = 'pending' | 'claimed' | 'sent' | 'cancelled'

export interface PendingWorkRow {
  id: string
  instance_id: string
  site_id: string
  user_id?: string | null
  message: string
  activity: string
  context: Record<string, unknown>
  system_prompt?: string | null
  status: PendingWorkStatus
  created_at: string
  claimed_at?: string | null
  sent_at?: string | null
}

export async function buildPendingWorkPayload(params: {
  siteId: string
  activity: string
  selectedContext: SelectedContextIds
  imageParameters?: ImageParameters
  videoParameters?: VideoParameters
  audioParameters?: AudioParameters
}): Promise<{ context: Record<string, unknown>; systemPrompt: string; userId?: string }> {
  const contextData = await contextService.getContextData(params.selectedContext, params.siteId)

  let mediaType = 'text'
  let currentParams: Record<string, unknown> = {}

  if (params.activity === 'generate-image') {
    mediaType = 'image'
    currentParams = { ...(params.imageParameters || {}) }
  } else if (params.activity === 'generate-video') {
    mediaType = 'video'
    currentParams = { ...(params.videoParameters || {}) }
  } else if (params.activity === 'generate-audio') {
    mediaType = 'audio'
    currentParams = { ...(params.audioParameters || {}) }
  }

  const expectedResults = currentParams.expectedResults || 1
  let context: Record<string, unknown> = {}

  if (contextData) {
    if (typeof contextData === 'object' && !Array.isArray(contextData)) {
      context = { ...contextData }
    } else {
      context.raw_context = contextData
    }
  }

  context.mediaType = mediaType
  context.output_type = mediaType
  context.parameters = { ...currentParams }
  context.expected_results_amount = expectedResults
  context.selected_context = params.selectedContext

  if ((context.parameters as Record<string, unknown>)?.expectedResults !== undefined) {
    delete (context.parameters as Record<string, unknown>).expectedResults
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return {
    context,
    systemPrompt: getSystemPromptForActivity(params.activity, {
      imageParameters: params.imageParameters,
      videoParameters: params.videoParameters,
      audioParameters: params.audioParameters,
    }),
    userId: user?.id,
  }
}

export async function enqueuePendingWork(params: {
  instanceId: string
  siteId: string
  userId?: string | null
  message: string
  activity: string
  context?: Record<string, unknown>
  systemPrompt?: string | null
}): Promise<{ id: string } | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('instance_pending_work')
    .insert({
      instance_id: params.instanceId,
      site_id: params.siteId,
      user_id: params.userId || null,
      message: params.message,
      activity: params.activity || 'ask',
      context: params.context || {},
      system_prompt: params.systemPrompt || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('Failed to enqueue pending work:', error)
    return null
  }

  return { id: data.id }
}

export async function cancelPendingWork(pendingId: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('instance_pending_work')
    .update({ status: 'cancelled' })
    .eq('id', pendingId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    console.error('Failed to cancel pending work:', error)
    return false
  }

  return true
}

export async function updatePendingWork(pendingId: string, message: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('instance_pending_work')
    .update({ message })
    .eq('id', pendingId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    console.error('Failed to update pending work:', error)
    return false
  }

  return true
}

export async function sendPendingWorkNow(params: {
  pendingId: string
  instanceId: string
}): Promise<{ success: boolean; error?: string }> {
  const { apiClient } = await import('@/app/services/api-client-service')
  const response = await apiClient.post('/api/robots/instance/pending-work/send-now', {
    pending_id: params.pendingId,
    instance_id: params.instanceId,
  })

  if (response.success) return { success: true }
  return { success: false, error: response.error?.message || 'Failed to send pending command' }
}
