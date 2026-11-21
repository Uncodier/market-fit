import { z } from 'zod'

export const resultId = z.string().uuid()
const label = z.string().max(200)
export const reportSchema = z.object({ title: label, note: z.string().max(500), columns: z.array(label).max(5),
  rows: z.array(z.array(label).max(5)).max(100), published: z.literal(true).optional(), next_after: z.string().max(48).optional(),
}).strict().refine(report => report.rows.every(r => r.length === report.columns.length))
export const indexSchema = z.array(z.object({ id: resultId, tool: z.string().regex(/^[A-Z0-9_]{1,150}$/),
  created_at: z.string().datetime({ offset: true }) }).strict()).max(20)

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const privateCopy = 'In Makinari, only the person who requested the report can open it while their access remains active. Robots receives a receipt, not these rows, and cannot summarize them automatically.'
export const privateHeaders = {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Cookie, Authorization', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
}
// An isolated document, not a hydrated workspace page: no analytics, previews, scripts,
// third-party assets, client cache or app-level data providers can observe result data.
function page(title: string, body: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private connector reports</title><style>body{max-width:62rem;margin:3rem auto;padding:0 1rem;font:1rem/1.55 system-ui,sans-serif;color:#20242c}nav{margin-bottom:2rem}th,td{text-align:left;border-bottom:1px solid #ccc;padding:.5rem;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}button{font:inherit;cursor:pointer}h1{line-height:1.2}a{color:#154c92}</style><main><nav><a href="/connectors">Connectors</a> / <a href="/connectors/results">Private reports</a></nav><h1>${escape(title)}</h1>${body}</main></html>`, { status, headers: privateHeaders })
}
export function unavailable(status: number) {
  const reason = status === 401 ? 'Sign in to the account that requested this report.' : status === 404
    ? 'This report is unavailable. It may have expired, your access may have changed, or it may belong to another user.'
    : status === 503 ? 'The private report service is unavailable. No result can be confirmed. Check your private reports before requesting another read.'
      : 'This private report request could not be authorized or verified. Check your report list before trying again.'
  return page('Private report unavailable', `<p>${reason}</p>`, status)
}
export function resultPage(id: string, r: z.infer<typeof reportSchema>) {
  const button = (choice: number, label: string) => `<form method="post" action="/connectors/results/${escape(id)}/open"><button type="submit" name="choice" value="${choice}">${label}</button></form>`
  const table = !r.rows.length ? (r.columns.length ? '<p>No rows were returned on this page.</p>' : '') : `<table><thead><tr>${r.columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}${r.published ? '<th>Action</th>' : ''}</tr></thead><tbody>${r.rows.map((row,i) => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}${r.published ? `<td>${button(i, 'Open private report')}</td>` : ''}</tr>`).join('')}</tbody></table>`
  return page(r.title, `<p>${privateCopy}</p><p>${escape(r.note)}</p>${table}${r.published && r.next_after ? button(-1, 'Next page of published reports') : ''}`)
}
export function indexPage(items: z.infer<typeof indexSchema>) {
  return page('Your private connector reports', `<p>${privateCopy}</p><p>The latest 20 reports are available for up to one hour. An expired or revoked report cannot be reopened.</p>${items.length ? `<ul>${items.map(item => `<li><a href="/connectors/results/${escape(item.id)}">${escape(item.tool)}</a> – ${escape(new Date(item.created_at).toUTCString())}</li>`).join('')}</ul>` : '<p>No private reports are currently available.</p>'}`)
}