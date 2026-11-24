"use client"

import { useRef, useState } from "react"
import { z } from "zod"
import { useLocalization } from "@/app/context/LocalizationContext"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { ConnectorError } from "./connector-feedback"
import { ConnectorRequestError, safeAuthorizationUrl } from "./connector-request"
import { bindTabAttempt, readTabAttempt } from "./callback/tab-continuation"
import { authAttemptSchema, type ConnectorDetail } from "./types"
import { useConnectorMutation } from "./use-connector-resource"
import { hostedCredentialScheme, setupGuidance } from "./connection-setup"

const redirectSchema = authAttemptSchema.extend({ continuation: z.string().regex(/^[a-f0-9]{64}$/) })
const setupSchema = z.object({ status: z.literal("available") })
const tokenSchema = z.object({ status: z.literal("completed"), connector_id: z.string().uuid() })

export function ConnectAccount({ siteId, detail, onChanged }: { siteId: string; detail: ConnectorDetail; onChanged: () => void }) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const [preferProjectToken, setPreferProjectToken] = useState(false)
  const { slug } = detail.toolkit
  const setup = detail.connection_setup
  const hosted = setup?.kind === "existing" || setup?.kind === "managed_oauth" || setup?.kind === "dynamic_oauth" || setup?.kind === "hosted_credentials"
  const configs = detail.auth_configs.filter(config => setup ? setup.kind === "existing" && setup.config_ids.includes(config.id)
    : config.auth_scheme === "OAUTH2" || (config.auth_scheme === "API_KEY" && slug !== "supabase"))
  const [selected, setSelected] = useState("")
  const projectInput = useRef<HTMLInputElement>(null)
  const tokenInput = useRef<HTMLInputElement>(null)
  const [invalid, setInvalid] = useState({ project: false, token: false })
  const configId = configs.length === 1 ? configs[0].id : configs.some(config => config.id === selected) ? selected : ""
  const expectedSetup = setup?.kind === "existing" ? configs.find(config => config.id === configId)?.setup_key
    : setup && "setup_key" in setup ? setup.setup_key : undefined
  const [redirectError, setRedirectError] = useState<unknown>()
  const [redirecting, setRedirecting] = useState(false)
  const hostedMutation = useConnectorMutation()
  const tokenMutation = useConnectorMutation()
  const canCreate = !setup && !configs.length && detail.can_create_managed_oauth === true
  const hasApiKey = detail.toolkit.auth_schemes.includes("API_KEY") || detail.auth_configs.some(config => config.auth_scheme === "API_KEY")
  const supabase = slug === "supabase" && (setup ? setup.kind === "supabase_token" || (setup.kind === "existing" && hasApiKey) : hasApiKey)
  const tokenMode = supabase && (preferProjectToken || (!configs.length && !canCreate))
  const mutation = tokenMode ? tokenMutation : hostedMutation
  const label = t(hosted || configs.length ? (detail.connections.length ? "connectors.connectAnother" : "connectors.connect")
    : canCreate ? "connectors.setUpOAuth" : supabase ? "connectors.supabaseSetup" : hasApiKey ? "connectors.apiKeySetup" : "connectors.setupRequired")
  const requiresSelection = setup?.kind === "existing" || (!hosted && !canCreate)

  const start = async () => {
    if (!detail.can_manage) return
    if (tokenMode) {
      // Read actual field values at submit, including credentials filled by Safari.
      const projectRef = projectInput.current?.value.trim() ?? ""
      const token = tokenInput.current?.value.trim() ?? ""
      const badProject = !/^[a-z0-9]{20}$/.test(projectRef)
      const badToken = !/^sbp_[A-Za-z0-9_-]{20,508}$/.test(token)
      setInvalid({ project: badProject, token: badToken })
      if (badProject || badToken) {
        (badProject ? projectInput : tokenInput).current?.focus()
        return
      }
      const pending = mutation.run("/api/connectors/supabase-token", { site_id: siteId, project_ref: projectRef, token, delegate_account: true }, tokenSchema)
      if (tokenInput.current) tokenInput.current.value = ""
      if (await pending) { setOpen(false); onChanged() }
      return
    }
    if (requiresSelection && !configId) return
    if (hosted && !expectedSetup) { setRedirectError(new ConnectorRequestError("auth_config_unavailable")); return }
    const scope = { site_id: siteId, toolkit_slug: slug }
    if (canCreate) {
      const result = await mutation.run("/api/connectors/managed-oauth", scope, setupSchema)
      if (result) onChanged()
      return
    }
    if (readTabAttempt()) { setRedirectError(new ConnectorRequestError("auth_attempt_ambiguous")); return }
    const result = await mutation.run(hosted ? "/api/connectors/auth-attempts/hosted" : "/api/connectors/auth-attempts/ask",
      { ...scope, ...(configId && { auth_config_id: configId }), ...(hosted && { expected_setup: expectedSetup }) }, redirectSchema)
    if (!result) return
    const url = safeAuthorizationUrl(result.redirect_url)
    if (!url) { setRedirectError(new ConnectorRequestError("outcome_unknown")); return }
    if (!bindTabAttempt(result.attempt_id, result.continuation)) { setRedirectError(new ConnectorRequestError("auth_attempt_ambiguous")); return }
    setRedirecting(true)
    window.location.assign(url)
  }

  if (!detail.can_manage || setup?.kind === "no_auth") return null
  if (setup?.kind === "admin_oauth" || setup?.kind === "admin_setup" || setup?.kind === "unavailable") return <>
    <TopBarPrimaryActions><Button onClick={() => setOpen(true)} variant="outline">{t("connectors.setupRequired")}</Button></TopBarPrimaryActions>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("connectors.setupRequired")}</DialogTitle></DialogHeader>
        <DialogBody><DialogDescription>{t(setupGuidance[setup.kind])}</DialogDescription></DialogBody>
        <DialogFooter>
          {setup.kind !== "unavailable" && <Button variant="outline" onClick={() => { setOpen(false); onChanged() }}>{t("connectors.refresh")}</Button>}
          <Button variant="outline" onClick={() => setOpen(false)}>{t("connectors.cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  const actionable = hosted || configs.length > 0 || canCreate || tokenMode
  const method = setup?.kind === "existing" ? configs.find(config => config.id === configId)?.auth_scheme : setup && "auth_scheme" in setup ? setup.auth_scheme : undefined
  const askUnavailable = detail.toolkit.toolkit_type === "mcp" || slug === "supabase" || (method && method !== "OAUTH2" && method !== "API_KEY")
  const usesHostedCredentials = setup?.kind === "hosted_credentials" || hostedCredentialScheme(configs.find(config => config.id === configId)?.auth_scheme)
  const hostedHelp = usesHostedCredentials ? "connectors.hostedCredentialHelp"
    : setup?.kind === "managed_oauth" ? (slug === "googlecalendar" ? "connectors.calendarManagedConnectHelp" : "connectors.managedConnectHelp")
    : setup?.kind === "dynamic_oauth" ? "connectors.dynamicConnectHelp" : "connectors.connectHelp"
  const error = mutation.error || redirectError
  const retryableTokenError = tokenMode && error instanceof ConnectorRequestError &&
    ["supabase_token_rejected", "supabase_token_check_unavailable"].includes(error.code)
  return <>
    <TopBarPrimaryActions><Button onClick={() => setOpen(true)}>{label}</Button></TopBarPrimaryActions>
    <Dialog open={open} onOpenChange={value => {
      if (mutation.pending || redirecting) return
      setOpen(value)
      if (!value) {
        if (tokenInput.current) tokenInput.current.value = ""
        setInvalid({ project: false, token: false })
        setPreferProjectToken(false)
      }
    }}>
      <DialogContent busy={mutation.pending || redirecting} aria-busy={mutation.pending || redirecting}>
        <DialogHeader><DialogTitle>{tokenMode ? t("connectors.supabaseSetup") : label}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4"><DialogDescription>
          {t(tokenMode ? "connectors.supabaseTokenHelp" : hosted ? hostedHelp : configs.length ? "connectors.connectHelp" : canCreate ? "connectors.managedOAuthHelp"
            : hasApiKey ? "connectors.apiKeyUnavailable" : "connectors.noAuthConfig")}
          {!tokenMode && hosted && <>
            <span className="mt-2 block font-medium text-foreground">{t(askUnavailable ? "connectors.hostedAskUnsupported" : "connectors.hostedAskOff")}</span>
            <span className="mt-2 block">{t("connectors.workspaceSharingDisclosure")}{slug === "gmail" && ` ${t("connectors.gmailSharingDisclosure")}`}
              {slug === "supabase" && ` ${t("connectors.supabaseOAuthAsk")}`}</span>
          </>}
          {(tokenMode || (!hosted && configs.length > 0)) && <>
            <span className="mt-2 block font-medium text-foreground">{t(tokenMode ? "connectors.tokenAskDisclosure" : slug === "supabase" ? "connectors.supabaseOAuthAsk" : "connectors.askOnConnect")}</span>
            <span className="mt-2 block">{(tokenMode || slug !== "supabase") && t("connectors.askOnConnectEffects")}
              {slug === "supabase" && ` ${t("connectors.supabaseAskLimit")}`}</span>
            <span className="mt-2 block">{t("connectors.workspaceSharingDisclosure")}{slug === "gmail" && ` ${t("connectors.gmailSharingDisclosure")}`}</span>
          </>}
        </DialogDescription>
        {supabase && configs.length > 0 && <Button type="button" variant="outline" size="sm" disabled={mutation.pending || redirecting} onClick={() => {
          if (tokenInput.current) tokenInput.current.value = ""
          setInvalid({ project: false, token: false })
          setRedirectError(undefined)
          setPreferProjectToken(!tokenMode)
        }}>{t(tokenMode ? "connectors.useOAuthInstead" : "connectors.useProjectTokenInstead")}</Button>}
        {!tokenMode && configs.length > 0 && <div className="space-y-2"><Label>{t("connectors.authConfig")}</Label>
          <Select value={configId} onValueChange={setSelected} disabled={mutation.pending}>
            <SelectTrigger aria-label={t("connectors.authConfig")}><SelectValue placeholder={t("connectors.selectAuthConfig")} /></SelectTrigger>
            <SelectContent>{configs.map(config => <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        {tokenMode && <div className="space-y-3 text-sm">
          <p>{t("connectors.supabaseTokenBoundary")}</p>
          <div className="space-y-2">
            <Label htmlFor="supabase-project-ref">{t("connectors.supabaseProjectRef")}</Label>
            <Input id="supabase-project-ref" ref={projectInput} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={mutation.pending}
              aria-invalid={invalid.project} aria-describedby="supabase-project-ref-help"
              onInput={() => setInvalid(value => value.project ? { ...value, project: false } : value)} />
            <p id="supabase-project-ref-help" role={invalid.project ? "alert" : undefined} className={invalid.project ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {t(invalid.project ? "connectors.supabaseProjectRefInvalid" : "connectors.supabaseProjectRefHelp")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supabase-token">{t("connectors.supabaseToken")}</Label>
            <Input id="supabase-token" ref={tokenInput} type="password" autoComplete="off" spellCheck={false} disabled={mutation.pending}
              aria-invalid={invalid.token} aria-describedby={invalid.token ? "supabase-token-error" : undefined}
              onInput={() => setInvalid(value => value.token ? { ...value, token: false } : value)} />
            {invalid.token && <p id="supabase-token-error" role="alert" className="text-xs text-destructive">{t("connectors.supabaseTokenInvalid")}</p>}
          </div>
          <a className="underline" href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer">{t("connectors.supabaseTokenLink")}</a>
        </div>}
        {!!error && <ConnectorError error={error} retry={retryableTokenError ? undefined : onChanged} />}
        {actionable && (hosted || tokenMode || !configs.length) && <p className="text-xs text-muted-foreground">{t("connectors.providerCosts")}</p>}
        </DialogBody>
        <DialogFooter>{actionable ? <Button disabled={(!tokenMode && requiresSelection && !configId) || mutation.pending || redirecting || (!!error && !retryableTokenError)} onClick={() => void start()}>
          {t(tokenMode ? (mutation.pending ? "connectors.supabaseVerifying" : "connectors.supabaseConnect")
            : canCreate ? (mutation.pending ? "connectors.creatingOAuth" : "connectors.createOAuth")
            : mutation.pending || redirecting ? "connectors.connecting" : usesHostedCredentials && hosted ? "connectors.continueToCredentials" : "connectors.continueAuth")}
        </Button> : <Button variant="outline" onClick={() => setOpen(false)}>{t("connectors.cancel")}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}