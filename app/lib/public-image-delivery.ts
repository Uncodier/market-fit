import { PUBLIC_PROMPT_IMAGE_ORIGIN, type PromptImageDelivery } from './prompt-image-url'

type HeaderReader = { get(name: string): string | null }
const PUBLIC_DEPLOYMENT_HOSTS = new Set(['www.makinari.com', 'makinari.com', 'app.makinari.com'])

/** A proxy may retain the app host. Both official deployments use the same image route.
 * Unknown/local/preview hosts stay relative; no request header becomes a fetch origin.
 */
export function publicImageDeliveryFromHeaders(headers: HeaderReader): PromptImageDelivery {
  const host = (headers.get('x-forwarded-host') || headers.get('host') || '')
    .split(',')[0].trim().toLowerCase().replace(/:443$/, '')
  return { scope: 'public', origin: PUBLIC_DEPLOYMENT_HOSTS.has(host) ? PUBLIC_PROMPT_IMAGE_ORIGIN : null }
}