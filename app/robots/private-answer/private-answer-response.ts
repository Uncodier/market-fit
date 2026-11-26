import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { privateHeaders } from '@/app/connectors/results/private-report-document'

const idSchema = z.string().uuid()
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const inlineHeaders = {
  ...privateHeaders,
  'X-Frame-Options': 'SAMEORIGIN',
  // Enforce an opaque origin even if embedded without the iframe sandbox attribute.
  'Content-Security-Policy': "sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
}

type Presentation = 'page' | 'inline' | 'download'
export type AnswerParams = { params: Promise<{ id: string }> }

function page(status: number, text: string, mode: Presentation, id?: string) {
  const inline = mode === 'inline'
  const target = inline ? ' target="_blank" rel="noopener noreferrer"' : ''
  const answer = escape(text).replace(/\[([^\]\r\n]{1,100})\]\((\/(?:connectors\/results|records)\/([a-f0-9-]{36}))\)/g,
    (whole, label: string, path: string, reportId: string) => idSchema.safeParse(reportId).success
      ? `<a href="${path}"${target}>${label}</a>` : whole)
  const download = status === 200 ? `<p><a href="/robots/private-answer/${id}/download"${target}>Download report (.md)</a></p>` : ''
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private Ask answer</title><style>:root{color-scheme:light dark}main{max-width:64rem;margin:1rem auto;padding:0 1rem;font:1rem/1.55 system-ui}article{white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:1.1rem}</style><main>${inline ? '' : '<a href="/robots">Robots</a>'}<h1>${status === 200 ? 'Private Ask answer' : 'Private answer unavailable'}</h1>${download}<article>${answer}</article></main></html>`,
    { status, headers: inline ? inlineHeaders : privateHeaders },
  )
}

export async function privateAnswerResponse(request: Request, { params }: AnswerParams, mode: Presentation) {
  try {
    const { id } = await params
    if (!idSchema.safeParse(id).success || new URL(request.url).search) return page(400, 'Invalid private answer reference.', mode)
    const db = await createClient(true)
    const { data, error } = await db.auth.getUser()
    if (error || !data?.user || !idSchema.safeParse(data.user.id).success || data.user.is_anonymous !== false) return page(401, 'Sign in with the account that requested this answer.', mode)
    const reply = await db.rpc('read_connector_ask_answer', { p_action_id: id }).abortSignal(AbortSignal.timeout(5000))
    if (reply.error) return page(503, 'Unable to verify access to this answer.', mode)
    if (reply.data == null) return page(404, 'This answer is unavailable for this account.', mode)
    if (typeof reply.data !== 'string' || reply.data.length > 65536) return page(503, 'Unable to read this answer.', mode)
    return mode === 'download' ? new Response(reply.data, { headers: {
      ...privateHeaders, 'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="private-ask-report.md"',
    } }) : page(200, reply.data, mode, id)
  } catch { return page(503, 'Unable to verify access to this answer.', mode) }
}