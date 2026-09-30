import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { userCanOnSite } from '@/lib/permissions/site-access'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { chatBackendUrl, isSameOriginChatRequest } from '../proxy-security'

export const maxDuration = 120
const PATH = '/api/agents/chat/intervention'
const uuid = z.string().uuid()
const inputSchema = z.object({
  conversationId: uuid.optional(),
  conversation_id: uuid.optional(),
  site_id: uuid,
  message: z.string().trim().min(1).max(20_000),
  message_id: uuid.optional(),
}).refine(input => Boolean(input.conversationId || input.conversation_id))
  .refine(input => !input.conversationId || !input.conversation_id || input.conversationId === input.conversation_id)

// Return only lifecycle identifiers, never provider payloads or database errors.
const responseSchema = z.object({
  success: z.boolean(),
  execution_started: z.boolean().optional(),
  data: z.object({
    execution_started: z.boolean().optional(),
    conversation_id: uuid.optional(),
    message_id: uuid.optional(),
    message: z.object({ message_id: uuid }).optional(),
    channel_send: z.object({
      success: z.boolean().optional(),
      method: z.string().max(80).optional(),
      workflowId: z.string().max(300).optional(),
      workflow_id: z.string().max(300).optional(),
      workflowRunId: z.string().max(300).optional(),
      run_id: z.string().max(300).optional(),
      callId: z.string().max(300).optional(),
      delivery_status: z.string().max(80).optional(),
    }).optional(),
  }).optional(),
  message_id: uuid.optional(),
  conversation_id: uuid.optional(),
  error: z.object({ code: z.string().max(100).optional() }).optional(),
})

function failure(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, {
    status, headers: { 'Cache-Control': 'no-store, private' },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginChatRequest(request)) {
    return failure('Origin not allowed', 403)
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return failure('JSON content type required', 415)
  }

  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 256_000))))
  } catch (error) {
    return failure('Invalid intervention request', error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  const access = await requireSiteAccess(request, input.site_id)
  if (access.error) return access.error
  if (!await userCanOnSite(access.supabase, input.site_id, input.message_id ? 'update' : 'insert')) {
    return failure('You do not have permission to send messages in this site.', 403)
  }
  const conversationId = input.conversationId || input.conversation_id!
  const { data: conversation, error: conversationError } = await access.supabase
    .from('conversations').select('id, site_id, agent_id, lead_id, visitor_id')
    .eq('id', conversationId).eq('site_id', input.site_id).maybeSingle()
  if (conversationError) return failure('Unable to verify conversation access', 503)
  if (!conversation) return failure('Conversation not found', 404)

  let message = input.message
  if (input.message_id) {
    const { data: saved, error } = await access.supabase.from('messages')
      .select('content, custom_data').eq('id', input.message_id)
      .eq('conversation_id', conversation.id).eq('user_id', access.userId)
      .eq('role', 'team_member').maybeSingle()
    if (error) return failure('Unable to verify the saved message', 503)
    if (!saved) return failure('Saved message not found', 404)
    const state = saved.custom_data as Record<string, unknown> | null
    if (state?.provider_call_id || state?.call_status === 'placement_unknown' || state?.status === 'placement_unknown' ||
      ['sent', 'delivered', 'sending', 'queued', 'running', 'in_progress'].includes(String(state?.status)) ||
      ['placing', 'queued', 'ringing', 'in_progress', 'completed'].includes(String(state?.call_status)) ||
      state?.command_status === 'success' ||
      (state?.command_status !== 'failed' && state?.status !== 'failed')) {
      return failure('This message cannot be retried while delivery is active or unconfirmed', 409)
    }
    message = saved.content
  }

  const { data: { session }, error: sessionError } = await access.supabase.auth.getSession()
  if (sessionError || !session?.access_token || session.user?.id !== access.userId) {
    return failure('Please sign in again to send messages.', 401)
  }
  const target = chatBackendUrl(request, PATH)
  if (!target) return failure('Intervention API is not configured', 503)

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        conversationId: conversation.id, conversation_id: conversation.id,
        site_id: conversation.site_id, user_id: access.userId,
        agentId: conversation.agent_id || undefined,
        lead_id: conversation.lead_id || undefined, visitor_id: conversation.visitor_id || undefined,
        message, message_id: input.message_id,
      }),
      cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
    })
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      await upstream.body?.cancel()
      return failure('Delivery could not be confirmed. Check the conversation before retrying.', 502)
    }
    const raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 256_000)))
    const parsed = responseSchema.safeParse(raw)
    if (!parsed.success) return failure('Delivery could not be confirmed. Check the conversation before retrying.', 502)
    const result = parsed.data
    const channel = result.data?.channel_send
    const status = upstream.ok ? upstream.status : [400, 401, 403, 404, 409, 429, 500, 503].includes(upstream.status) ? upstream.status : 502
    return Response.json({
      ...result,
      ...(channel?.success === false ? { data: { ...result.data, channel_send: {
        ...channel,
        error: channel.callId || channel.workflowId || channel.workflow_id || channel.workflowRunId || channel.run_id
          ? 'Delivery started; check the conversation for its latest status.'
          : channel.delivery_status === 'placement_unknown'
          ? 'Call placement is unconfirmed. Check the conversation before retrying.'
          : channel.method === 'voice_agent_call'
            ? 'Voice delivery was not started. Check the lead phone, call consent, and connected Voice sender.'
            : 'Delivery was not started. Check the conversation channel and recipient.',
      } } } : {}),
      ...(!upstream.ok || !result.success ? { error: {
        code: result.error?.code,
        message: status === 401 ? 'Please sign in again to send messages.'
          : status === 403 ? 'You do not have permission to send this intervention.'
            : result.error?.code === 'MESSAGE_SAVE_FAILED' ? 'The intervention message could not be saved.'
              : 'Intervention request failed. Check the conversation before retrying.',
      } } : {}),
    }, { status, headers: { 'Cache-Control': 'no-store, private' } })
  } catch {
    // A timeout does not prove that the API did not save or place the call.
    return failure('Delivery could not be confirmed. Check the conversation before retrying.', 502)
  }
}