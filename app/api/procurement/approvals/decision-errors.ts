import { procurementError } from '../http'

/** Only known business failures are safe to expose; unknown SQL details stay private. */
const failures = [
  { code: '40001', messages: ['Policy changed; request a new approval', 'Policy changed'], status: 409,
    explanation: 'The workspace policy changed after this approval was requested. Open the document and request a new approval under the current policy.' },
  { code: '40001', messages: ['Approval changed', 'Stage changed'], status: 409,
    explanation: 'This approval or stage is no longer pending. Reload the approvals list to see its current status before taking another action.' },
  { code: '22023', messages: ['Deadline reached'], status: 409,
    explanation: 'The deadline for this approval stage has passed. Ask the policy manager to review the deadline and request a new approval.' },
  { code: '22023', messages: ['Earlier stage pending'], status: 409,
    explanation: 'An earlier approval stage is still pending. Complete that stage before deciding this one.' },
  { code: '42501', messages: ['Ineligible approver or pending AI review'], status: 403,
    explanation: 'You are not eligible to decide this stage under its saved approval plan, or it requires an AI review. Check the assigned approvers and decision mode.' },
] as const

export function decisionBusinessError(error: { code?: string; message?: string } | null) {
  if (!error) return null
  const code = error.code === 'PT409' ? '40001' : error.code
  const failure = failures.find(item => item.code === code && item.messages.some(message => message === error.message))
  return failure ? procurementError(failure.explanation, failure.status) : null
}