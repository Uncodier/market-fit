import { configuredApiUrl } from '@/lib/http/api-proxy-security'

export { isSameOriginApiRequest as isSameOriginChatRequest } from '@/lib/http/api-proxy-security'

/** Only server-configured destinations and fixed chat endpoints may receive user tokens. */
export function chatBackendUrl(
  request: Request,
  path: '/api/agents/chat/intervention' | '/api/agents/chat/message',
): URL | null {
  return configuredApiUrl(request, path)
}