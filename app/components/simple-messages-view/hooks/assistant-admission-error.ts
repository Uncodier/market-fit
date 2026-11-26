import type { ApiResponse } from '@/app/services/api-client-response'

type AdmissionFailure = 'busy' | 'capacity' | 'unavailable'

export function isAssistantResultUnconfirmed(response: ApiResponse): boolean {
  if (response.success || response.execution_started === false) return false
  if (!response.error?.code && [500, 502, 503, 504].includes(response.status ?? 0)) return true
  return [
    'ASSISTANT_STREAM_MISSING',
    'ASSISTANT_STREAM_INCOMPLETE',
    'ASSISTANT_STREAM_INTERRUPTED',
    'ASSISTANT_START_UNCONFIRMED',
    'ASSISTANT_ADMISSION_UNCONFIRMED',
    'ASSISTANT_CONNECTION_UNCONFIRMED',
    'ASSISTANT_START_FAILED', // Older servers could lose the workflow start acknowledgement.
    'ASSISTANT_WORKFLOW_INCOMPLETE', // Also used when a recovery checkpoint may still be active.
    'ASSISTANT_WORKFLOW_CONTINUING',
    'ASSISTANT_RESPONSE_TIMEOUT',
    'ASSISTANT_STATUS_UNAVAILABLE',
  ].includes(response.error?.code || '')
}

export function assistantUnconfirmedNotification(code?: string) {
  if (code === 'ASSISTANT_WORKFLOW_CONTINUING') {
    return {
      title: 'Assistant is still working',
      description: 'This request is continuing in the background. Follow its progress in this conversation instead of resending it.',
    }
  }
  return {
    title: 'Assistant status unconfirmed',
    description: 'A final result could not be confirmed. Check this turn for updates before sending the message again.',
  }
}

export function getAssistantAdmissionFailure(response: ApiResponse): AdmissionFailure | null {
  if (response.success || response.execution_started === true) return null

  switch (response.error?.code) {
    case 'ASSISTANT_EXECUTION_BUSY': return 'busy'
    case 'ASSISTANT_CAPACITY_FULL': return 'capacity'
    case 'ASSISTANT_ADMISSION_UNAVAILABLE': return 'unavailable'
  }

  // Older proxies did not provide a code. Do not interpret unrelated conflicts
  // or gateway failures as proof that this execution never started.
  if (response.error?.code) return null
  const message = response.error?.message.trim().replace(/\.$/, '')
  if (response.status === 409 && message === 'This assistant execution is already in progress') return 'busy'
  if (response.status === 503 && message === 'Assistant capacity is temporarily full') return 'capacity'
  return null
}

export function assistantAdmissionNotification(failure: AdmissionFailure) {
  if (failure === 'busy') {
    return {
      title: 'Assistant is busy',
      description: 'Another assistant execution is already in progress. This message was not sent. Wait for it to finish before sending again.',
    }
  }
  return {
    title: 'Assistant is temporarily unavailable',
    description: failure === 'capacity'
      ? 'Assistant capacity is temporarily full. This message was not sent. Please try again later.'
      : 'The assistant is temporarily unavailable. This message was not sent. Please try again later.',
  }
}