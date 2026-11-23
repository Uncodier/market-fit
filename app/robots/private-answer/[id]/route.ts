import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { privateHeaders } from '@/app/connectors/results/private-report-document'

const idSchema = z.string().uuid()
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const renderAnswer = (text: string) => escape(text).replace(
  /\[([^\]\r\n]{1,100})\]\((\/connectors\/results\/[a-f0-9-]{36})\)/g,
  (whole, label: string, path: string) => idSchema.safeParse(path.split('/').at(-1)).success
    ? `<a href="${path}">${label}</a>` : whole,
)

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const page = (status: number, text: string) => new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private Ask answer</title><style>main{max-width:64rem;margin:2rem auto;padding:0 1rem;font:1rem/1.55 system-ui}article{white-space:pre-wrap;overflow-wrap:anywhere}</style><main><a href="/robots">Robots</a><h1>${status === 200 ? 'Private Ask answer' : 'Private answer unavailable'}</h1><article>${renderAnswer(text)}</article></main></html>`,
    { status, headers: privateHeaders },
  )
  try {
    const { id } = await params
    if (!idSchema.safeParse(id).success || new URL(request.url).search) return page(400, 'Invalid private answer reference.')
    const db = await createClient(true)
    const { data, error } = await db.auth.getUser()
    if (error || !data?.user || !idSchema.safeParse(data.user.id).success || data.user.is_anonymous !== false) return page(401, 'Sign in with the account that requested this answer.')
    // The actor is derived from this user's database session; never use service-role reads.
    const reply = await db.rpc('read_connector_ask_answer', { p_action_id: id }).abortSignal(AbortSignal.timeout(5000))
    if (reply.error) return page(503, 'Unable to verify access to this answer.')
    if (reply.data == null) return page(404, 'This answer is unavailable for this account.')
    return typeof reply.data === 'string' && reply.data.length <= 65536
      ? page(200, reply.data) : page(503, 'Unable to read this answer.')
  } catch { return page(503, 'Unable to verify access to this answer.') }
}