"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/app/components/ui/button"
import { Check, Lock, X } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ConnectorRequestError } from "@/app/connectors/connector-request"
import { useConnectorMutation } from "@/app/connectors/use-connector-resource"
import { approvalReceipt } from "@/app/connectors/approval-contract"
import { type ReviewRequest, usePrivateReviews } from "./private-reviews"

type Receipt = { item: ReviewRequest; decision: "approve" | "reject"; result?: string; omitted?: boolean }

export function PrivateReviewThread({ conversationId, internal = false }: { conversationId: string; internal?: boolean }) {
  const { authorized } = usePrivateReviews()
  if (!authorized) return null
  return <ReviewCards key={conversationId} conversationId={conversationId} internal={internal} />
}

function ReviewCards({ conversationId, internal }: { conversationId: string; internal: boolean }) {
  const { byConversation, reload } = usePrivateReviews()
  const { t } = useLocalization()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  // A claimed row can leave the pending list before the provider response is
  // ready. Keep its mounted mutation alive within this authorized thread.
  const [inFlight, setInFlight] = useState<ReviewRequest[]>([])
  // An uncertain decision is never retried. Only an explicit refresh followed
  // by a new authorized list containing this exact request can re-enable it.
  const [checking, setChecking] = useState<ReviewRequest[]>([])
  const listed = byConversation.get(conversationId) ?? []
  const requests = [...listed, ...inFlight.filter(item => !listed.some(entry => entry.id === item.id))]
    .filter(item => !receipts.some(r => r.item.id === item.id))
  if (!requests.length && !receipts.length) return internal ? <p role="status">{t("connectors.noApprovals")}</p> : null
  return <section aria-label={t("connectors.privateReview")} className="w-full space-y-3">
    {receipts.map(r => <ReviewMessage key={r.item.id} item={r.item} completed={r.decision === "approve"}>
      <p role="status">{t(r.decision === "approve" ? "connectors.approvalCompleted" : "connectors.approvalRejected")}</p>
      {r.result !== undefined && <details><summary>{t("connectors.privateResult")}</summary><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all p-2 text-xs">{r.result}</pre></details>}
      {r.omitted && <p>{t("connectors.largeResult")}</p>}
    </ReviewMessage>)}
    {requests.map(item => checking.includes(item) ? <p key={item.id} role="status">{t("connectors.loadingApprovals")}</p> : <RequestCard key={item.id} item={item}
      onStart={() => setInFlight(old => [...old.filter(r => r.id !== item.id), item])} onRefresh={() => {
      setInFlight(old => old.filter(r => r.id !== item.id))
      setChecking(old => [...old.filter(checked => checked.id !== item.id), item]); reload()
    }} onDone={receipt => {
      setInFlight(old => old.filter(r => r.id !== item.id))
      setReceipts(old => [...old, receipt]); reload()
    }} />)}
  </section>
}

function RequestCard({ item, onDone, onRefresh, onStart }: { item: ReviewRequest; onDone: (receipt: Receipt) => void; onRefresh: () => void; onStart: () => void }) {
  const { siteId, refreshing } = usePrivateReviews()
  const { t } = useLocalization()
  const mutation = useConnectorMutation()
  const expires = Date.parse(item.expires_at)
  const [expired, setExpired] = useState(() => expires <= Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function check() {
      const remaining = expires - Date.now()
      setExpired(remaining <= 0)
      if (remaining > 0) timer = setTimeout(check, Math.min(2_147_483_647, remaining))
    }
    check()
    return () => clearTimeout(timer)
  }, [expires])
  const disabled = refreshing || mutation.pending || !!mutation.error || expired
  const decide = async (decision: "approve" | "reject") => {
    if (disabled || expires <= Date.now()) return
    onStart()
    const receipt = await mutation.run(`/api/connectors/approvals/${item.id}/${decision}`, { site_id: siteId }, approvalReceipt(item.id, decision))
    if (receipt) onDone({ item, decision, result: JSON.stringify(receipt.result, null, 2), omitted: receipt.result_omitted })
  }
  const status = mutation.error instanceof ConnectorRequestError ? mutation.error.status : undefined
  return <ReviewMessage item={item}>
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-muted px-2 py-1.5">
      <Button type="button" size="sm" variant="ghost" className="gap-1.5 px-2 py-1 text-xs" disabled={disabled} onClick={() => void decide("approve")}><Check className="h-3.5 w-3.5" />{t("connectors.approveAndRun")}</Button>
      <Button type="button" size="sm" variant="ghost" className="gap-1.5 px-2 py-1 text-xs" disabled={disabled} onClick={() => void decide("reject")}><X className="h-3.5 w-3.5" />{t("connectors.rejectRequest")}</Button>
    </div>
    {expired && <p role="status">{t("connectors.reviewExpired")}</p>}
    {!!mutation.error && <div role="alert"><p>{t(status === 409 || status === 410 ? "connectors.reviewStale" : "connectors.approvalUnconfirmed")}</p>
      <Button variant="outline" size="sm" onClick={onRefresh}>{t("connectors.refreshApprovals")}</Button></div>}
  </ReviewMessage>
}

function ReviewMessage({ item, children, completed }: { item: ReviewRequest; children: ReactNode; completed?: boolean }) {
  const { t } = useLocalization()
  const sender = item.context?.agent_label || item.agent_label || t("details.chat.agent")
  return <article className="group min-w-0 max-w-[95%] px-4 text-sm md:max-w-[75%] md:px-0">
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <Avatar aria-hidden="true" className="h-7 w-7 border border-primary/10"><AvatarFallback className="bg-primary/10 text-xs text-primary">{sender.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</AvatarFallback></Avatar>
      <h3 className="break-words font-medium text-primary">{sender}</h3>
      {item.context?.instance_label && <span className="text-xs text-muted-foreground">{item.context.instance_label}</span>}
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock size={14} />{t("connectors.privateReview")}</span>
    </div>
    <div className="ml-9 space-y-2">
      <div className={`space-y-2 rounded-lg p-4 ${completed ? "border border-green-500/30 bg-green-50/50 dark:bg-green-900/10" : "bg-muted/60"}`}>
        {item.context?.source_excerpt && <blockquote className="break-words border-l-2 border-primary/30 pl-3">{item.context.source_excerpt}</blockquote>}
        <p className="break-words">{item.account_label} · <code className="break-all text-xs">{item.tool_slug}</code></p>
        <details open={Object.keys(item.arguments).length > 0}><summary className="cursor-pointer text-xs text-muted-foreground">{t("connectors.reviewDetails")}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{t("connectors.requestVersion", { version: item.version, date: new Date(item.expires_at).toLocaleString() })}</p>
          <pre dir="ltr" className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(item.arguments, null, 2)}</pre>
        </details>
      </div>
      {children}
      {item.created_at && <time dateTime={item.created_at} className="block text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time>}
    </div>
  </article>
}
