import { createClient } from '@/lib/supabase/client'

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504])
const RESPONSE_LOG_TYPES = ['agent_action', 'system', 'tool_call', 'tool_result']
export const USER_ACTION_DEDUPE_WINDOW_MS = 2 * 60 * 1000

export type ApiPostResult<T = any> = {
  success: boolean
  data?: T
  error?: { message: string }
  status?: number
}

export type PostWithRetryOptions = {
  maxAttempts?: number
  instanceId?: string
  message?: string
}

export function isRetryableApiFailure(response: {
  success: boolean
  status?: number
}): boolean {
  if (response.success) return false
  if (response.status == null) return true
  if (RETRYABLE_STATUS.has(response.status)) return true
  return response.status >= 500
}

export function createRequestId(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState !== 'visible'
}

export function waitUntilTabVisible(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible)
        resolve()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
  })
}

export function collapseDuplicateUserActions<T extends {
  log_type?: string
  message?: string | null
  created_at?: string
}>(logs: T[]): T[] {
  const result: T[] = []
  for (const log of logs) {
    if (log.log_type !== 'user_action') {
      result.push(log)
      continue
    }

    const previous = result[result.length - 1]
    if (
      previous?.log_type === 'user_action' &&
      previous.message === log.message &&
      previous.created_at &&
      log.created_at
    ) {
      const delta = Math.abs(
        new Date(log.created_at).getTime() - new Date(previous.created_at).getTime()
      )
      if (delta <= USER_ACTION_DEDUPE_WINDOW_MS) continue
    }

    result.push(log)
  }
  return result
}

export async function hasAgentResponseForMessage(params: {
  instanceId: string
  message: string
}): Promise<boolean> {
  const supabase = createClient()

  const { data: userLogs, error: userError } = await supabase
    .from('instance_logs')
    .select('id, created_at')
    .eq('instance_id', params.instanceId)
    .eq('log_type', 'user_action')
    .eq('message', params.message)
    .order('created_at', { ascending: true })
    .limit(1)

  if (userError) {
    console.error('Failed to look up user message for retry skip:', userError)
    return false
  }

  const userLog = userLogs?.[0]
  if (!userLog?.created_at) return false

  const { data: responses, error: responseError } = await supabase
    .from('instance_logs')
    .select('id')
    .eq('instance_id', params.instanceId)
    .in('log_type', RESPONSE_LOG_TYPES)
    .gt('created_at', userLog.created_at)
    .limit(1)

  if (responseError) {
    console.error('Failed to look up agent response for retry skip:', responseError)
    return false
  }

  return Boolean(responses?.[0]?.id)
}

export async function persistUserActionLog(params: {
  instanceId: string
  siteId: string
  userId?: string | null
  message: string
  requestId?: string
}): Promise<{ id: string } | null> {
  const supabase = createClient()

  const { data: existing, error: lookupError } = await supabase
    .from('instance_logs')
    .select('id')
    .eq('instance_id', params.instanceId)
    .eq('log_type', 'user_action')
    .eq('message', params.message)
    .order('created_at', { ascending: false })
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
        ...(params.requestId ? { request_id: params.requestId } : {}),
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

export async function markRobotInstanceErrorIfUnanswered(params: {
  instanceId: string
  siteId: string
  userId?: string | null
  errorMessage: string
  message?: string
}): Promise<boolean> {
  if (params.message && await hasAgentResponseForMessage({
    instanceId: params.instanceId,
    message: params.message,
  })) {
    return false
  }
  return markRobotInstanceError(params)
}

function resolveRetryOptions(
  maxAttemptsOrOptions: number | PostWithRetryOptions = 3
): Required<Pick<PostWithRetryOptions, 'maxAttempts'>> & PostWithRetryOptions {
  if (typeof maxAttemptsOrOptions === 'number') {
    return { maxAttempts: maxAttemptsOrOptions }
  }
  return {
    maxAttempts: maxAttemptsOrOptions.maxAttempts ?? 3,
    instanceId: maxAttemptsOrOptions.instanceId,
    message: maxAttemptsOrOptions.message,
  }
}

async function skipIfAlreadyAnswered<T>(
  instanceId?: string,
  message?: string
): Promise<ApiPostResult<T> | null> {
  if (!instanceId || !message) return null
  if (await hasAgentResponseForMessage({ instanceId, message })) {
    return { success: true, data: { alreadyAnswered: true } as T }
  }
  return null
}

export async function postWithRetry<T = any>(
  endpoint: string,
  payload: unknown,
  maxAttemptsOrOptions: number | PostWithRetryOptions = 3
): Promise<ApiPostResult<T>> {
  const { apiClient } = await import('@/app/services/api-client-service')
  const { maxAttempts, instanceId, message } = resolveRetryOptions(maxAttemptsOrOptions)
  let lastResponse: ApiPostResult<T> | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await waitUntilTabVisible()

    const skipped = await skipIfAlreadyAnswered<T>(instanceId, message)
    if (skipped) return skipped

    lastResponse = await apiClient.post<T>(endpoint, payload)
    if (lastResponse.success) return lastResponse

    if (attempt < maxAttempts && isRetryableApiFailure(lastResponse)) {
      const skippedAfterFailure = await skipIfAlreadyAnswered<T>(instanceId, message)
      if (skippedAfterFailure) return skippedAfterFailure
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
      continue
    }

    const skippedOnGiveUp = await skipIfAlreadyAnswered<T>(instanceId, message)
    if (skippedOnGiveUp) return skippedOnGiveUp
    return lastResponse
  }

  const skippedFinal = await skipIfAlreadyAnswered<T>(instanceId, message)
  if (skippedFinal) return skippedFinal
  return lastResponse || { success: false, error: { message: 'Request failed' } }
}
