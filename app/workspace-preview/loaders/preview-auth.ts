import type { UserResponse } from '@supabase/supabase-js'
import { WorkspacePreviewError } from '../types'

// getUser has no AbortSignal. Serialize these optional calls across preview
// remounts; never share the previous actor's result or cache an admission.
const waiting = new Set<() => void>()
let checking = false

function waitForAuth(signal: AbortSignal) {
  return new Promise<void>(resolve => {
    function wake() {
      waiting.delete(wake)
      signal.removeEventListener('abort', wake)
      resolve()
    }
    waiting.add(wake)
    signal.addEventListener('abort', wake, { once: true })
  })
}

export async function readPreviewAuth(signal: AbortSignal, getUser: () => Promise<UserResponse>): Promise<UserResponse> {
  while (checking && !signal.aborted) await waitForAuth(signal)
  if (signal.aborted) throw new WorkspacePreviewError()
  checking = true
  try {
    return await getUser()
  } finally {
    checking = false
    for (const wake of waiting) wake()
  }
}