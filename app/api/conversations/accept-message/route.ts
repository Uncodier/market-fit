import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { userCanOnSite } from '@/lib/permissions/site-access'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import {
  acceptedMetadata, commentTargetId, mayHaveLegacyComments, metadata, needsCommentApproval,
  validCommentApproval, type ApprovalConversation,
} from './comment-approval'

const inputSchema = z.object({ messageId: z.string().uuid() }).strict()
const headers = { 'Cache-Control': 'no-store, private' }
const conflict = 'This message changed or is no longer pending. Refresh the conversation before approving.'
const invalidTarget = 'The exact comment reply target could not be verified. Select a comment and create a new reply.'

function failure(error: string, status: number): Response {
  return Response.json({ success: false, error }, { status, headers })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure('Origin not allowed', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return failure('JSON content type required', 415)
  }
  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096))))
  } catch (error) {
    return failure('Invalid approval request', error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  try {
    // Never fall back to demo or service-role access for moderation.
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return failure('Unauthorized', 401)

    const { data: message, error: lookupError } = await supabase.from('messages')
      .select('id, content, role, conversation_id, custom_data, conversations!inner(id, site_id, channel, status, custom_data)')
      .eq('id', input.messageId).maybeSingle()
    if (lookupError) return failure('Unable to load message', 503)
    if (!message) return failure('Message not found', 404)
    const conversation: ApprovalConversation | undefined = Array.isArray(message.conversations)
      ? message.conversations[0] : message.conversations
    if (!conversation?.site_id || conversation.id !== message.conversation_id) return failure('Message not found', 404)
    if (!await userCanOnSite(supabase, conversation.site_id, 'update')) {
      return failure('You do not have permission to approve messages in this site.', 403)
    }

    const current = metadata(message.custom_data)
    if (!['assistant', 'team_member'].includes(message.role) ||
      !['pending', 'accepted'].includes(String(current.status))) return failure(conflict, 409)
    let comment = needsCommentApproval(current, conversation)
    if (!comment && mayHaveLegacyComments(conversation)) {
      // Detect legacy comment context only; this must never choose a reply target.
      const { data: inbound, error } = await supabase.from('messages').select('id')
        .eq('conversation_id', conversation.id).eq('role', 'user')
        .eq('custom_data->>source', 'comment').limit(1)
      if (error) return failure('Unable to verify comment context', 503)
      comment = Boolean(inbound?.length)
    }
    if (comment) {
      if (current.status === 'pending' && current.comment_delivery_status != null) return failure(conflict, 409)
      const targetId = commentTargetId(current)
      if (!targetId) return failure(invalidTarget, 409)
      const { data: target, error } = await supabase.from('messages')
        .select('id, role, conversation_id, custom_data, conversations!inner(site_id)')
        .eq('id', targetId).eq('conversation_id', conversation.id)
        .eq('conversations.site_id', conversation.site_id).eq('role', 'user').maybeSingle()
      if (error) return failure('Unable to verify comment reply target', 503)
      const targetConversation = Array.isArray(target?.conversations) ? target.conversations[0] : target?.conversations
      if (targetConversation?.site_id !== conversation.site_id || !validCommentApproval(conversation, message, target)) {
        return failure(invalidTarget, 409)
      }
    }
    if (current.status === 'accepted') {
      return Response.json({ success: true, updatedCustomData: current }, { headers })
    }

    const updatedCustomData = acceptedMetadata(current, conversation, comment)
    // Full JSON equality protects exact routing and delivery claims from stale writers.
    let update = supabase.from('messages')
      .update({ custom_data: updatedCustomData, updated_at: new Date().toISOString() })
      .eq('id', message.id).eq('conversation_id', conversation.id).eq('role', message.role)
      .eq('custom_data->>status', 'pending').eq('custom_data', JSON.stringify(current))
    update = message.content == null ? update.is('content', null) : update.eq('content', message.content)
    const { data: updated, error: updateError } = await update.select('id').maybeSingle()
    if (updateError) return failure('Failed to accept message', updateError.code === '42501' ? 403 : 500)
    if (!updated) return failure(conflict, 409)

    // Approval is durable now. A secondary conversation update must not report it as failed.
    if (typeof conversation.status === 'string' && conversation.status !== 'active') {
      try {
        const { error } = await supabase.from('conversations').update({ status: 'active' })
          .eq('id', conversation.id).eq('site_id', conversation.site_id).eq('status', conversation.status)
        if (error) console.error('Accepted message; conversation status update failed')
      } catch {
        console.error('Accepted message; conversation status update unavailable')
      }
    }
    return Response.json({ success: true, updatedCustomData }, { headers })
  } catch {
    return failure('Internal server error', 500)
  }
}
