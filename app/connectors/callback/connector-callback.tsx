"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { z } from "zod"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { CheckCircle } from "@/app/components/ui/icons"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorError, ConnectorLoading } from "../connector-feedback"
import { connectorRequest, ConnectorRequestError } from "../connector-request"
import { clearCompletedTabAttempt, readTabAttempt } from "./tab-continuation"

const completionSchema = z.object({ connector_id: z.string(), toolkit_slug: z.string(), status: z.literal("completed"), site_id: z.string().uuid().optional() })
const credentialAttemptSchema = z.string().uuid()
type Completion = z.infer<typeof completionSchema>
export default function ConnectorCallback() {
  const params = useSearchParams()
  const { user, isLoading } = useAuthContext()
  const { t } = useLocalization()
  // Capture once in memory. Never persist or display provider proof, or trust account IDs from the URL.
  const [proof] = useState(() => ({ attempt: params.get("attempt_id"), session: params.get("session_uri"),
    credentialAttempt: params.get("credential_attempt"), duplicate: ["attempt_id", "session_uri", "credential_attempt", "error", "status"].some(key => params.getAll(key).length > 1),
    denied: params.has("error") || params.get("status")?.toLowerCase() === "failed" }))
  // Read sessionStorage after hydration, never from a server-rendered snapshot.
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady)
  const [tab] = useState(readTabAttempt)
  const [identity, setIdentity] = useState<{ actor?: string; changed: boolean }>({ actor: user?.id, changed: false })
  // Bind this callback to the first authenticated actor, even before
  // completion starts. Switching back must not revive this callback.
  const actorChanged = identity.changed || (!isLoading && !!identity.actor && identity.actor !== user?.id)
  if (!isLoading && !identity.actor && user) setIdentity({ actor: user.id, changed: false })
  else if (actorChanged && !identity.changed) setIdentity({ ...identity, changed: true })
  const startedCheck = useRef(-1)
  const [check, setCheck] = useState(0)
  const mounted = useRef(false)
  const [state, setState] = useState<{ actor: string; result?: Completion; error?: unknown }>()
  const credentialFlow = proof.session === null && credentialAttemptSchema.safeParse(proof.credentialAttempt).success
  const target = credentialFlow ? proof.credentialAttempt : tab?.attempt_id
  const invalidProof = proof.denied || proof.duplicate || !target ||
    (proof.attempt !== null && proof.attempt !== target) || (tab && tab.attempt_id !== target) ||
    (!credentialFlow && (proof.credentialAttempt !== null || !proof.session || proof.session.length > 4096))
  useEffect(() => {
    mounted.current = true
    window.history.replaceState(window.history.state, "", "/connectors/callback")
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (!hydrated || isLoading || !user || actorChanged || startedCheck.current === check || invalidProof || !target) return
    startedCheck.current = check
    const actor = user.id
    // One submission per explicit check, including under StrictMode. A lost
    // response and single-use OAuth proofs are never replayed.
    connectorRequest(`/api/connectors/auth-attempts/${encodeURIComponent(target)}/complete`, completionSchema, {
      method: "POST", body: JSON.stringify(credentialFlow ? { hosted_credentials: true } : { session_uri: proof.session, continuation: tab?.continuation }),
    }).then(
      result => { clearCompletedTabAttempt(target); if (mounted.current) setState({ actor, result }) },
      error => { if (mounted.current) setState({ actor, error }) },
    )
  }, [hydrated, isLoading, user, proof, tab, target, invalidProof, actorChanged, credentialFlow, check])
  const current = state?.actor === user?.id ? state : undefined
  const retryableCredential = credentialFlow && current?.error instanceof ConnectorRequestError && ["connector_not_active", "credential_check_unavailable"].includes(current.error.code)
  if (hydrated && user && !invalidProof && !actorChanged && current?.result) {
    const { connector_id, toolkit_slug, site_id } = current.result
    const query = new URLSearchParams({ connector: connector_id, ...(site_id && { workspace: site_id }) })

    return <div className="mx-auto max-w-lg px-4 py-10">
      <SectionCard>
        <SectionCardContent className="space-y-6 px-6 py-8 text-center sm:px-8">
          <div role="status" className="space-y-3">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle aria-hidden="true" className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("connectors.callbackSuccessTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("connectors.callbackSuccess")}</p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild><Link href={`/connectors/${encodeURIComponent(toolkit_slug)}?${query}`}>{t("connectors.reviewAccess")}</Link></Button>
            <Button asChild variant="outline"><Link href="/connectors">{t("connectors.backToCatalog")}</Link></Button>
          </div>
        </SectionCardContent>
      </SectionCard>
    </div>
  }

  return <div className="mx-auto max-w-2xl px-4 py-10">
    <SectionCard><SectionCardHeader title={t("connectors.callbackTitle")} description={t("connectors.callbackHelp")} />
      <SectionCardContent>
        {!hydrated ? <ConnectorLoading /> : !isLoading && !user ? <p>{t("connectors.errors.unauthorized")}</p> : invalidProof ? <ConnectorError error={new ConnectorRequestError(proof.denied ? "cancelled" : "invalid_callback")} /> : actorChanged ? <ConnectorError error={new ConnectorRequestError("forbidden", 403)} /> : current?.error ? <>
          <ConnectorError error={current.error} />
          {retryableCredential && <Button variant="outline" onClick={() => { setState(undefined); setCheck(value => value + 1) }}>{t("connectors.checkCredentialAccount")}</Button>}
        </> : <ConnectorLoading />}
        <Button asChild variant="outline"><Link href="/connectors">{t("connectors.backToCatalog")}</Link></Button>
      </SectionCardContent>
    </SectionCard>
  </div>
}

// Render the same loading state on the server and during hydration; the captured
// tab marker stays stable even after the successful request clears storage.
const subscribeHydration = () => () => {}
const clientReady = () => true
const serverReady = () => false