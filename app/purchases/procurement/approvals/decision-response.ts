import { errorKeys } from '../i18n/error-keys'

const fallback = 'Decision not confirmed. Check assignment, deadline and current document revision, then reload.'
export const decisionTimeoutMessage = 'Decision result could not be confirmed in time. Close this dialog and reload the approval status before trying again.'

export class DecisionConflictError extends Error {}

/** A deadline is not proof of rollback. Never replay a timed-out decision automatically. */
export async function submitDecision(url: string, body: unknown, timeoutMs = 20000): Promise<void> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(decisionTimeoutMessage))
      controller.abort()
    }, timeoutMs)
  })
  try {
    await Promise.race([(async () => {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal })
      if (!response.ok) {
        const message = await decisionFailure(response)
        throw response.status === 409 ? new DecisionConflictError(message) : new Error(message)
      }
      const result: unknown = await response.json()
      const expectedId = /\/approvals\/([^/]+)\/decisions/.exec(url)?.[1]
      if (!result || typeof result !== 'object' || !('id' in result) ||
        typeof result.id !== 'string' || !expectedId || result.id !== expectedId) {
        throw new Error(decisionTimeoutMessage)
      }
    })(), deadline])
  } finally { clearTimeout(timer) }
}

/** Only display application-owned diagnostics, never arbitrary database payloads. */
export async function decisionFailure(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' &&
      Object.prototype.hasOwnProperty.call(errorKeys, body.error)) return body.error
  } catch { /* A non-JSON failure still leaves the decision unconfirmed. */ }
  return fallback
}