import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { userCanOnSite } from '@/lib/permissions/site-access'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { chatBackendUrl, isSameOriginChatRequest } from '../proxy-security'

export const maxDuration = 120
const uuid = z.string().uuid()
const inputSchema = z.object({
  conversationId: uuid,
  site_id: uuid,
  message: z.string().trim().min(1).max(20_000),
})

// Only expose the persisted assistant reply consumed by the chat UI.
const responseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    conversation_id: uuid.optional(),
    messages: z.object({
      assistant: z.object({ message_id: uuid, content: z.string().min(1).max(100_000) }),
    }),
  }),
})
const unconfirmed = 'Message acceptance could not be confirmed. Check the conversation before retrying.'

function failure(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, {
    status, headers: { 'Cache-Control': 'no-store, private' },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginChatRequest(request)) return failure('Origin not allowed', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return failure('JSON content type required', 415)
  }

  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 256_000))))
  } catch (error) {
    return failure('Invalid agent message request', error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  const access = await requireSiteAccess(request, input.site_id)
  if (access.error) return access.error
  if (!await userCanOnSite(access.supabase, input.site_id, 'insert')) {
    return failure('You do not have permission to send messages in this site.', 403)
  }
  const { data: conversation, error: conversationError } = await access.supabase
    .from('conversations').select('id, site_id, agent_id, lead_id, visitor_id')
    .eq('id', input.conversationId).eq('site_id', input.site_id).maybeSingle()
  if (conversationError) return failure('Unable to verify conversation access', 503)
  if (!conversation) return failure('Conversation not found', 404)
  if (!conversation.agent_id) return failure('This conversation has no assigned agent.', 409)

  const { data: agent, error: agentError } = await access.supabase
    .from('agents').select('id').eq('id', conversation.agent_id).eq('site_id', conversation.site_id).maybeSingle()
  if (agentError) return failure('Unable to verify agent access', 503)
  if (!agent) return failure('Agent not found in this site', 404)

  const { data: { session }, error: sessionError } = await access.supabase.auth.getSession()
  if (sessionError || !session?.access_token || session.user?.id !== access.userId) {
    return failure('Please sign in again to send messages.', 401)
  }
  const target = chatBackendUrl(request, '/api/agents/chat/message')
  if (!target) return failure('Agent chat API is not configured', 503)

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        conversationId: conversation.id, site_id: conversation.site_id,
        agentId: agent.id, team_member_id: access.userId,
        lead_id: conversation.lead_id || undefined, visitor_id: conversation.visitor_id || undefined,
        message: input.message,
      }),
      cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
    })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      const status = [400, 401, 403, 404, 409, 429, 500, 503].includes(upstream.status) ? upstream.status : 502
      return failure(status === 401 ? 'Please sign in again to send messages.'
        : status === 403 ? 'You do not have permission to send this message.' : unconfirmed, status)
    }
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      await upstream.body?.cancel()
      return failure(unconfirmed, 502)
    }
    const raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 256_000)))
    const parsed = responseSchema.safeParse(raw)
    if (!parsed.success || (parsed.data.data.conversation_id && parsed.data.data.conversation_id !== conversation.id)) {
      return failure(unconfirmed, 502)
    }
    return Response.json(parsed.data, {
      status: upstream.status, headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch {
    // A failed HTTP request does not prove that the API did not persist the turn.
    return failure(unconfirmed, 502)
  }
}