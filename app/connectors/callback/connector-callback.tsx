"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { z } from "zod"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorError, ConnectorLoading } from "../connector-feedback"
import { connectorRequest, ConnectorRequestError } from "../connector-request"
import { useConnectorResource } from "../use-connector-resource"

const completionSchema = z.object({ connector_id: z.string(), toolkit_slug: z.string(), status: z.literal("completed") })
type Completion = z.infer<typeof completionSchema>
const pendingSchema = z.object({ items: z.array(z.object({
  attempt_id: z.string(), site_id: z.string(), toolkit_slug: z.string(), status: z.string(),
})) })

function PendingAttempts({ onSelect }: { onSelect: (attempt: string) => void }) {
  const { t } = useLocalization()
  const { data, error, reload } = useConnectorResource("/api/connectors/pending-auth", pendingSchema)
  if (error) return <ConnectorError error={error} retry={reload} />
  if (!data) return <ConnectorLoading />
  const pending = data.items.filter(attempt => attempt.status === "pending")
  return <div className="space-y-4">
    <h3 className="font-medium">{t("connectors.selectAttempt")}</h3><p className="text-sm text-muted-foreground">{t("connectors.selectAttemptHelp")}</p>
    {!pending.length && <p>{t("connectors.noAttempts")}</p>}
    {pending.map(attempt => <div key={attempt.attempt_id} className="space-y-2 rounded-lg border p-3">
      <p>{attempt.toolkit_slug}</p><p className="text-xs text-muted-foreground">{t("connectors.attemptWorkspace", { site: attempt.site_id })}</p>
      <Button variant="outline" onClick={() => onSelect(attempt.attempt_id)}>{t("connectors.completeAttempt")}</Button>
    </div>)}
  </div>
}

export default function ConnectorCallback() {
  const params = useSearchParams()
  const { user, isLoading } = useAuthContext()
  const { t } = useLocalization()
  // Capture once in memory. Never persist or display provider proof, or trust account IDs from the URL.
  const [proof] = useState(() => ({ attempt: params.get("attempt_id"), session: params.get("session_uri"), denied: params.get("error") }))
  const [attempt, setAttempt] = useState(proof.attempt)
  const [identity, setIdentity] = useState<{ actor?: string; changed: boolean }>({ actor: user?.id, changed: false })
  // Bind proof and manual selection to the first authenticated actor, even before
  // completion starts. Switching back must not revive this callback.
  const actorChanged = identity.changed || (!isLoading && !!identity.actor && identity.actor !== user?.id)
  if (!isLoading && !identity.actor && user) setIdentity({ actor: user.id, changed: false })
  else if (actorChanged && !identity.changed) setIdentity({ ...identity, changed: true })
  const started = useRef(false)
  const mounted = useRef(false)
  const [state, setState] = useState<{ actor: string; result?: Completion; error?: unknown }>()
  const invalidProof = proof.denied || (attempt && !/^[a-z0-9-]{1,100}$/i.test(attempt)) || !proof.session || proof.session.length > 8192
  useEffect(() => {
    mounted.current = true
    window.history.replaceState(window.history.state, "", "/connectors/callback")
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (isLoading || !user || actorChanged || started.current || invalidProof || !attempt) return
    started.current = true
    const actor = user.id
    // One submission, including under StrictMode. A lost response is not automatically replayed.
    connectorRequest(`/api/connectors/auth-attempts/${encodeURIComponent(attempt)}/complete`, completionSchema, {
      method: "POST", body: JSON.stringify({ session_uri: proof.session }),
    }).then(
      result => { if (mounted.current) setState({ actor, result }) },
      error => { if (mounted.current) setState({ actor, error }) },
    )
  }, [isLoading, user, proof, attempt, invalidProof, actorChanged])
  const current = state?.actor === user?.id ? state : undefined
  return <div className="mx-auto max-w-2xl px-4 py-10">
    <SectionCard><SectionCardHeader title={t("connectors.callbackTitle")} description={t("connectors.callbackHelp")} />
      <SectionCardContent>
        {!isLoading && !user ? <p>{t("connectors.errors.unauthorized")}</p> : invalidProof ? <ConnectorError error={new ConnectorRequestError(proof.denied ? "cancelled" : "invalid_callback")} /> : actorChanged ? <ConnectorError error={new ConnectorRequestError("forbidden", 403)} /> : current?.error ? <ConnectorError error={current.error} /> : !isLoading && user && !attempt ? <PendingAttempts key={user.id} onSelect={setAttempt} /> : current?.result ?
          <div className="space-y-4"><p role="status">{t("connectors.callbackSuccess")}</p><Button asChild><Link href={`/connectors/${encodeURIComponent(current.result.toolkit_slug)}?connector=${encodeURIComponent(current.result.connector_id)}`}>{t("connectors.reviewAccess")}</Link></Button></div> : <ConnectorLoading />}
        <Button asChild variant="outline"><Link href="/connectors">{t("connectors.backToCatalog")}</Link></Button>
      </SectionCardContent>
    </SectionCard>
  </div>
}