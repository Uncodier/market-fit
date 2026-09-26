import { createClient } from '@/lib/supabase/client'
import { withTimeout } from '@/app/services/request-timeout'
import { getAssistantAdmissionFailure } from './assistant-admission-error'

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504])
export const USER_ACTION_DEDUPE_WINDOW_MS = 2 * 60 * 1000

export type ApiPostResult<T = any> = {
  success: boolean
  data?: T
  error?: { message: string; code?: string }
  status?: number
  retryable?: boolean
  execution_started?: boolean
}

export type PostWithRetryOptions = {
  maxAttempts?: number
  instanceId?: string
  message?: string
  requestId?: string
}

export function isRetryableApiFailure(response: ApiPostResult): boolean {
  if (response.success) return false
  if (getAssistantAdmissionFailure(response)) return false
  if (response.retryable === false) return false
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
    let timeoutId: NodeJS.Timeout

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        cleanup()
        resolve()
      }
    }

    const onFocusOrPageShow = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocusOrPageShow)
      window.removeEventListener('pageshow', onFocusOrPageShow)
      clearTimeout(timeoutId)
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocusOrPageShow)
    window.addEventListener('pageshow', onFocusOrPageShow)

    timeoutId = setTimeout(() => {
      cleanup()
      resolve()
    }, 2000)
  })
}

export function collapseDuplicateUserActions<T extends {
  log_type?: string
  message?: string | null
  created_at?: string
  details?: { request_id?: unknown } | null
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
      const previousRequest = previous.details?.request_id
      const currentRequest = log.details?.request_id
      if ((previousRequest || currentRequest) && previousRequest !== currentRequest) {
        result.push(log)
        continue
      }
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
  requestId?: string
}): Promise<boolean> {
  // Text is not a turn identity. Repeating a prompt must never reuse an old answer.
  if (!params.requestId) return false
  const supabase = createClient()

  const { data: userLogs, error: userError } = await supabase
    .from('instance_logs')
    .select('id, created_at')
    .eq('instance_id', params.instanceId)
    .eq('log_type', 'user_action')
    .eq('message', params.message)
    .eq('details->>request_id', params.requestId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (userError) {
    console.error('Failed to look up user message for retry skip:', userError)
    return false
  }

  const userLog = userLogs?.[0]
  if (!userLog?.created_at) return false

  const { data: laterTurns, error: laterError } = await supabase
    .from('instance_logs')
    .select('created_at')
    .eq('instance_id', params.instanceId)
    .eq('log_type', 'user_action')
    .gt('created_at', userLog.created_at)
    .order('created_at', { ascending: true })
    .limit(1)
  if (laterError) return false

  let responseQuery = supabase
    .from('instance_logs')
    .select('id')
    .eq('instance_id', params.instanceId)
    .eq('log_type', 'agent_action')
    .or('details->>streaming.is.null,details->>streaming.eq.false')
    .gt('created_at', userLog.created_at)
  if (laterTurns?.[0]?.created_at) {
    responseQuery = responseQuery.lt('created_at', laterTurns[0].created_at)
  }
  const { data: responses, error: responseError } = await responseQuery.limit(1)

  if (responseError) {
    console.error('Failed to look up agent response for retry skip:', responseError)
    return false
  }

  return Boolean(responses?.[0]?.id)
}

function buildWorkflowDetails(
  extras: {
    requestId?: string
    activity?: string
    context?: unknown
    attachments?: unknown
    status?: 'running'
  },
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    ...(existing || {}),
    prompt_source: 'frontend',
    client_persisted: true,
    status: extras.status || existing?.status || 'running',
    request_type: extras.activity || existing?.request_type || 'ask',
    ...(extras.requestId ? { request_id: extras.requestId } : {}),
    ...(extras.context !== undefined ? { context: extras.context } : {}),
    ...(extras.attachments !== undefined ? { attachments: extras.attachments } : {}),
  }
}

export async function persistUserActionLog(params: {
  instanceId: string
  siteId: string
  userId?: string | null
  message: string
  requestId?: string
  activity?: string
  context?: unknown
  attachments?: unknown
  status?: 'running'
}): Promise<{ id: string } | null> {
  const supabase = createClient()

  if (params.requestId) {
    const { data: existing, error: lookupError } = await supabase
      .from('instance_logs')
      .select('id')
      .eq('instance_id', params.instanceId)
      .eq('log_type', 'user_action')
      .eq('details->>request_id', params.requestId)
      .limit(1)
    if (lookupError) return null
    if (existing?.[0]?.id) return { id: existing[0].id }
  }

  const { data, error } = await supabase
    .from('instance_logs')
    .insert([
      {
        log_type: 'user_action',
        level: 'info',
        message: params.message,
        details: buildWorkflowDetails(params),
        instance_id: params.instanceId,
        site_id: params.siteId,
        user_id: params.userId || null,
      }
    ])
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('Failed to persist user message:', error)
    return null
  }

  return { id: data.id }
}

export async function markUserLogWorkflowStatus(params: {
  logId: string
  status: 'running' | 'stopped' | 'cancelled'
}): Promise<boolean> {
  const supabase = createClient()
  const { data: userLog, error: lookupError } = await supabase
    .from('instance_logs')
    .select('id, details')
    .eq('id', params.logId)
    .single()

  if (lookupError || !userLog?.id) {
    console.error('Failed to look up workflow log:', lookupError)
    return false
  }

  const { error } = await supabase
    .from('instance_logs')
    .update({
      details: {
        ...(userLog.details || {}),
        status: params.status,
      },
    })
    .eq('id', params.logId)

  if (error) {
    console.error('Failed to update workflow status:', error)
    return false
  }

  return true
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

  const { error: logError } = await supabase.from('instance_logs').insert([
    {
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
    }
  ])

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
  requestId?: string
}): Promise<boolean> {
  if (params.message && await hasAgentResponseForMessage({
    instanceId: params.instanceId,
    message: params.message,
    requestId: params.requestId,
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
    requestId: maxAttemptsOrOptions.requestId,
  }
}

async function skipIfAlreadyAnswered<T>(
  instanceId?: string,
  message?: string,
  requestId?: string,
): Promise<ApiPostResult<T> | null> {
  if (!instanceId || !message || !requestId) return null
  try {
    if (await withTimeout(
      hasAgentResponseForMessage({ instanceId, message, requestId }), 2500,
      'Checking the current assistant response timed out.',
    )) {
      return { success: true, data: { alreadyAnswered: true } as T }
    }
  } catch {
    // A failed read is not proof of completion and must not prevent the POST.
  }
  return null
}

export async function postWithRetry<T = any>(
  endpoint: string,
  payload: unknown,
  maxAttemptsOrOptions: number | PostWithRetryOptions = 3
): Promise<ApiPostResult<T>> {
  const { apiClient } = await import('@/app/services/api-client-service')
  const { maxAttempts, instanceId, message, requestId } = resolveRetryOptions(maxAttemptsOrOptions)
  let lastResponse: ApiPostResult<T> | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await waitUntilTabVisible()
      const skipped = await skipIfAlreadyAnswered<T>(instanceId, message, requestId)
      if (skipped) return skipped
    }

    lastResponse = await apiClient.post<T>(endpoint, payload)
    if (lastResponse.success) return lastResponse
    if (endpoint === '/api/robots/instance/assistant' && (
      getAssistantAdmissionFailure(lastResponse) ||
      lastResponse.error?.code?.startsWith('ASSISTANT_') ||
      [500, 502, 504].includes(lastResponse.status ?? 0)
    )) {
      // Admission rejections require an explicit resend, not automatic replay.
      // Gateway/start failures cannot establish whether the workflow was accepted.
      return { ...lastResponse, retryable: false }
    }
    if (!isRetryableApiFailure(lastResponse)) return lastResponse

    if (attempt < maxAttempts && isRetryableApiFailure(lastResponse)) {
      const skippedAfterFailure = await skipIfAlreadyAnswered<T>(instanceId, message, requestId)
      if (skippedAfterFailure) return skippedAfterFailure
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
      continue
    }

    const skippedOnGiveUp = await skipIfAlreadyAnswered<T>(instanceId, message, requestId)
    if (skippedOnGiveUp) return skippedOnGiveUp
    return lastResponse
  }

  const skippedFinal = await skipIfAlreadyAnswered<T>(instanceId, message, requestId)
  if (skippedFinal) return skippedFinal
  return lastResponse || { success: false, error: { message: 'Request failed' } }
}
