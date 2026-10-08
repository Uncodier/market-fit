import type Stripe from 'stripe'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'

const terminal = (status: string) => ['canceled', 'incomplete_expired'].includes(status)
const objectId = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id

/** Called only while holding the site checkout lease. Browser cancellation does not expire Checkout. */
export async function prepareSubscriptionCheckout(params: {
  stripe: Stripe; customerId: string; siteId: string; metadata: Record<string, string>
  successUrl: string; cancelUrl: string
  beforeProviderWrite: () => void; afterProviderWrite: () => void
}) {
  const { stripe, customerId, siteId } = params
  const conflict = () => new SubscriptionRequestError('Subscription checkout changed or completed; refresh billing before trying again', 409)
  const owned = (session: Stripe.Checkout.Session) => objectId(session.customer) === customerId &&
    session.metadata?.site_id === siteId && session.metadata?.type === 'subscription'
  const list = async () => {
    // Include completed sessions: a just-completed checkout may precede subscription-list visibility.
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 100 })
    if (sessions.has_more) throw new SubscriptionRequestError('Checkout history requires billing support review', 409)
    const relevant = sessions.data.filter(session => session.mode === 'subscription')
    if (relevant.some(session => !['open', 'complete', 'expired'].includes(session.status ?? ''))) throw conflict()
    for (const session of relevant.filter(session => session.status === 'complete')) {
      const subscriptionId = objectId(session.subscription)
      if (!owned(session) || !subscriptionId) throw conflict()
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      if (objectId(sub.customer) !== customerId || !terminal(sub.status)) throw conflict()
    }
    return relevant
  }
  let sessions = await list()
  const open = sessions.filter(session => session.status === 'open')
  if (open.length > 1) throw conflict()
  if (open.length) {
    // Refresh immediately before reuse/expiration, since Checkout can complete outside our lease.
    const current = await stripe.checkout.sessions.retrieve(open[0].id)
    if (!owned(current) || current.mode !== 'subscription' || current.status !== 'open') throw conflict()
    if (current.url && current.success_url === params.successUrl && current.cancel_url === params.cancelUrl &&
        Object.entries(params.metadata).every(([key, value]) => current.metadata?.[key] === value)) {
      return { existing: { url: current.url, sessionId: current.id }, generation: '' }
    }
    params.beforeProviderWrite()
    const expired = await stripe.checkout.sessions.expire(current.id)
    params.afterProviderWrite()
    // Never interpret an error or a completed/racing expiration response as successful replacement.
    if (expired.id !== current.id || expired.status !== 'expired') throw conflict()
    const confirmed = await stripe.checkout.sessions.retrieve(current.id)
    if (confirmed.status !== 'expired') throw conflict()
    sessions = await list()
    if (sessions.some(session => session.status === 'open')) throw conflict()
  }
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  if (subscriptions.has_more || subscriptions.data.some(sub => !terminal(sub.status))) throw conflict()
  // Revisiting A after A -> B must not reuse Stripe's idempotent result for the now-expired A.
  const generation = sessions.filter(session => session.status === 'expired' && owned(session))
    .map(session => session.id).sort().join(',')
  return { existing: null, generation }
}