import type { ApiResponse } from './api-client-response'
import { withTimeout } from './request-timeout'

const STREAM_TIMEOUT_MS = 13 * 60 * 1000
const MAX_EVENT_CHARACTERS = 1024 * 1024

function streamFailure(message: string, code: string): ApiResponse<never> {
  // Once a stream is open the workflow may already have side effects. Never replay it.
  return { success: false, status: 200, retryable: false, error: { message, code } }
}

function readEvent<T>(frame: string): ApiResponse<T> | null {
  let event = ''
  const data: string[] = []
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return null // Keepalive comments are not completion.

  const payload = JSON.parse(data.join('\n'))
  if (event === 'error' || payload.type === 'error' || payload.success === false) {
    return streamFailure(
      typeof payload.error?.message === 'string'
        ? payload.error.message
        : 'The assistant could not complete this request. Please try again.',
      typeof payload.error?.code === 'string' ? payload.error.code : 'ASSISTANT_WORKFLOW_FAILED',
    )
  }
  if ((event === 'completed' || payload.type === 'completed') && payload.success === true) {
    return { success: true, status: 200, data: payload.data ?? payload }
  }
  return null // An accepted event is not evidence of success.
}

export async function consumeApiEventStream<T>(response: Response): Promise<ApiResponse<T>> {
  const reader = response.body?.getReader()
  if (!reader) return streamFailure('The assistant response stream is missing.', 'ASSISTANT_STREAM_MISSING')

  const decoder = new TextDecoder()
  let buffer = ''
  const deadline = Date.now() + STREAM_TIMEOUT_MS
  try {
    while (true) {
      const { value, done } = await withTimeout(
        reader.read(),
        Math.max(1, deadline - Date.now()),
        'The assistant response timed out. The workflow may still be running. Check the conversation before sending again.',
      )
      buffer += decoder.decode(value, { stream: !done })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        if (frame.length > MAX_EVENT_CHARACTERS) throw new Error('Assistant response event is too large.')
        const result = readEvent<T>(frame)
        if (result) return result
      }
      if (buffer.length > MAX_EVENT_CHARACTERS) throw new Error('Assistant response event is too large.')
      if (done) {
        return streamFailure(
          'The assistant connection ended before completion was confirmed. Check the conversation before sending again.',
          'ASSISTANT_STREAM_INCOMPLETE',
        )
      }
    }
  } catch {
    return streamFailure(
      'The assistant connection was interrupted or timed out. The workflow may still be running. Check the conversation before sending again.',
      'ASSISTANT_STREAM_INTERRUPTED',
    )
  } finally {
    // Do not let a stalled cancellation hide the terminal result from the UI.
    void reader.cancel().catch(() => {}).finally(() => reader.releaseLock())
  }
}