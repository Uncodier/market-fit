"use client"

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { ToolCatalogSearch } from '@/app/connectors/tool-catalog-search'
import { taskConnectorDescriptor, taskConnectorReview, taskConnectorResult, taskConnectorRevocation,
  type TaskConnectorDescriptor, type TaskConnectorReview, type TaskConnectorResult } from './task-connector-contract'

type Action = 'describe' | 'review' | 'publish' | 'revoke' | 'result'

export function TaskConnectorAuthorization({ siteId, instanceId, nodeId, selectedId, toolkit }: {
  siteId: string; instanceId: string; nodeId: string; selectedId?: string | null; toolkit?: string
}) {
  const [browse, setBrowse] = useState(false)
  const [tool, setTool] = useState('')
  const [text, setText] = useState('{}')
  const [descriptor, setDescriptor] = useState<TaskConnectorDescriptor | null>(null)
  const [review, setReview] = useState<TaskConnectorReview | null>(null)
  const [result, setResult] = useState<TaskConnectorResult | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => { active.current?.abort(); active.current = null }, [])
  function choose(slug: string) { setBrowse(false); setTool(slug); setText('{}'); setDescriptor(null); setReview(null); setResult(null); setMessage('') }
  async function submit(action: Action) {
    if (active.current) return
    const fields: Record<string, unknown> = {}
    if (action === 'describe' || action === 'review' || action === 'publish') {
      if (!selectedId || !tool) return
      fields.tool_slug = tool
      if (action !== 'describe') {
        if (!descriptor) return
        try { fields.arguments = JSON.parse(text) } catch { setMessage('Enter arguments as a JSON object.'); return }
        if (!fields.arguments || typeof fields.arguments !== 'object' || Array.isArray(fields.arguments)) { setMessage('Enter arguments as a JSON object.'); return }
      }
      if (action === 'publish') { if (!review || review.published) return; fields.digest = review.digest }
    }
    const controller = new AbortController()
    active.current = controller
    const timer = setTimeout(() => controller.abort(), 30000)
    setPending(true); setMessage(''); setResult(null)
    try {
      const response = await fetch('/api/workflows/task-connector', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ site_id: siteId, instance_id: instanceId, node_id: nodeId, action, ...fields }),
      })
      if (controller.signal.aborted) throw new Error('Unconfirmed')
      if (!response.ok) {
        setReview(null); setMessage([400,403,404,422].includes(response.status) ? 'No eligible operation, arguments, authorization or private result. Check account access and tool settings.' :
          response.status === 409 ? 'The configuration changed. Check the action and review again.' : 'Could not confirm this operation. Review before retrying.'); return
      }
      const data: unknown = await response.json()
      if (controller.signal.aborted) throw new Error('Unconfirmed')
      if (action === 'describe') {
        const next = taskConnectorDescriptor.parse(data)
        if (next.tool_slug !== tool || next.connector_id !== selectedId || next.toolkit_slug !== toolkit) throw new Error('Unconfirmed')
        setDescriptor(next); setReview(null)
      } else if (action === 'result') setResult(taskConnectorResult.parse(data))
      else if (action === 'revoke') { taskConnectorRevocation.parse(data); setReview(null); setMessage('Scheduled access revoked.') }
      else {
        const next = taskConnectorReview.parse(data)
        if (next.operation !== tool || next.connector_id !== selectedId || next.instance_id !== instanceId || next.node_id !== nodeId ||
          next.toolkit_slug !== toolkit || next.toolkit_version !== descriptor?.toolkit_version || next.schema_hash !== descriptor.schema_hash ||
          (action === 'publish' && (!next.published || next.digest !== review?.digest))) throw new Error('Unconfirmed')
        setReview(next)
      }
    } catch { if (active.current === controller) { setReview(null); setDescriptor(null); setMessage('Could not confirm this operation. Check the action and review again.') } }
    finally { clearTimeout(timer); if (active.current === controller) { active.current = null; setPending(false) } }
  }
  return <fieldset disabled={pending} className="space-y-2 border-t pt-2 text-xs">
    <legend>Scheduled authorization</legend>
    <p>Select a read action from this account’s catalog. Compatibility and current permissions are verified before publication and dispatch.</p>
    {toolkit && selectedId && <><Button type="button" size="sm" aria-expanded={browse} onClick={() => setBrowse(!browse)}>
      {tool || 'Choose catalog action'}</Button>
      {browse && <ToolCatalogSearch siteId={siteId} slug={toolkit} selected={[]} fixedAction="read" onSelect={choose} />}</>}
    <Button type="button" size="sm" disabled={!tool} onClick={() => void submit('describe')}>Check action</Button>
    {descriptor && <><details><summary>Accepted input schema</summary><pre className="max-h-44 overflow-auto">{JSON.stringify(descriptor.input_schema, null, 2)}</pre></details>
      <label>Arguments (JSON)<Textarea maxLength={12000} value={text} onChange={e => { setText(e.target.value); setReview(null); setResult(null) }} /></label>
      <Button type="button" size="sm" onClick={() => void submit('review')}>Review schedule</Button></>}
    {review && <div><p>{review.published ? 'Published' : 'Not published'} · {review.cron} ({review.timezone})</p>
      <p>Account {review.connector_id} · {review.operation} · version {review.toolkit_version}</p>
      <pre className="max-h-40 overflow-auto">{JSON.stringify(review.arguments, null, 2)}</pre><p>Result visible only to the approving member.</p>
      {!review.published && <Button type="button" size="sm" onClick={() => void submit('publish')}>Authorize and publish</Button>}</div>}
    <Button type="button" size="sm" variant="outline" onClick={() => void submit('result')}>View private result</Button>
    <Button type="button" size="sm" variant="ghost" onClick={() => void submit('revoke')}>Revoke scheduled access</Button>
    {message && <p role="status">{message}</p>}
    {result && <section aria-label="Private result"><h4>{result.report.title}</h4><p>{result.report.note}</p>
      <div className="max-h-48 overflow-auto"><table><thead><tr>{result.report.columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
        <tbody>{result.report.rows.map(([field, value], i) => <tr key={i}><td>{field}</td><td>{value}</td></tr>)}</tbody></table></div></section>}
  </fieldset>
}
