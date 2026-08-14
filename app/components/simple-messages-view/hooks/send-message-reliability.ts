import { createClient } from '@/lib/supabase/client'

const DUPLICATE_WINDOW_MS = 60_000
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504])

export function isRetryableApiFailure(response: {
  success: boolean
  status?: number
}): boolean {
  if (response.success) return false
  if (response.status == null) return true
  if (RETRYABLE_STATUS.has(response.status)) return true
  return response.status >= 500
}

export async function persistUserActionLog(params: {
  instanceId: string
  siteId: string
  userId?: string | null
  message: string
}): Promise<{ id: string } | null> {
  const supabase = createClient()
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()

  const { data: existing, error: lookupError } = await supabase
    .from('instance_logs')
    .select('id')
    .eq('instance_id', params.instanceId)
    .eq('log_type', 'user_action')
    .eq('message', params.message)
    .gte('created_at', since)
    .limit(1)

  if (lookupError) {
    console.error('Failed to check existing user message:', lookupError)
  } else if (existing?.[0]?.id) {
    return { id: existing[0].id }
  }

  const { data, error } = await supabase
    .from('instance_logs')
    .insert({
      log_type: 'user_action',
      level: 'info',
      message: params.message,
      details: {
        prompt_source: 'frontend',
        client_persisted: true,
      },
      instance_id: params.instanceId,
      site_id: params.siteId,
      user_id: params.userId || null,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('Failed to persist user message:', error)
    return null
  }

  return { id: data.id }
}

export async function markRobotInstanceError(params: {
  instanceId: string
  siteId: string
  userId?: string | null
  errorMessage: string
}): Promise<boolean> {
  const supabase = createClient()
  const { error: updateError } = await supabase
    .from('remote_instances')
    .update({
      status: 'error',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.instanceId)

  if (updateError) {
    console.error('Failed to mark robot as error:', updateError)
    return false
  }

  const { error: logError } = await supabase.from('instance_logs').insert({
    log_type: 'error',
    level: 'error',
    message: `Failed after retries: ${params.errorMessage}`.slice(0, 2000),
    details: {
      error: params.errorMessage,
      source: 'frontend_retry_exhausted',
    },
    instance_id: params.instanceId,
    site_id: params.siteId,
    user_id: params.userId || null,
  })

  if (logError) {
    console.error('Failed to log robot error:', logError)
  }

  return true
}

export async function postWithRetry<T = any>(
  endpoint: string,
  payload: unknown,
  maxAttempts = 3
): Promise<{ success: boolean; data?: T; error?: { message: string }; status?: number }> {
  const { apiClient } = await import('@/app/services/api-client-service')
  let lastResponse: { success: boolean; data?: T; error?: { message: string }; status?: number } | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResponse = await apiClient.post<T>(endpoint, payload)
    if (lastResponse.success) return lastResponse
    if (attempt < maxAttempts && isRetryableApiFailure(lastResponse)) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
      continue
    }
    return lastResponse
  }

  return lastResponse || { success: false, error: { message: 'Request failed' } }
}
