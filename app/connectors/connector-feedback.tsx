"use client"

import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Plug } from "@/app/components/ui/icons"
import { connectorErrorKey } from "./connector-request"

export function ConnectorLoading() {
  const { t } = useLocalization()
  return <div role="status" className="space-y-4 p-6"><span className="sr-only">{t("connectors.loading")}</span>
    {[1, 2, 3].map(key => <Skeleton key={key} className="h-28 w-full rounded-xl" />)}
  </div>
}

export function ConnectorError({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useLocalization()
  return <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4 text-sm">
    <p>{t(`connectors.errors.${connectorErrorKey(error)}`)}</p>
    {retry && <Button variant="outline" size="sm" onClick={retry}>{t("connectors.refresh")}</Button>}
  </div>
}

export function ConnectorEmpty({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <EmptyState variant="simple" icon={<Plug />} title={title} description={description} action={action} />
}

/** Keying the feature retires account data, drafts and pending redirects on scope changes. */
export function ConnectorSiteScope({ children, loading }: { children: (siteId: string, scope: string) => React.ReactNode; loading: React.ReactNode }) {
  const { currentSite, isLoading } = useSite()
  const auth = useAuthContext()
  const { t } = useLocalization()
  if (auth.isLoading || isLoading) return loading
  if (!auth.user) return <ConnectorEmpty title={t("connectors.signIn")} description={t("connectors.errors.unauthorized")} />
  if (!currentSite?.id) return <ConnectorEmpty title={t("connectors.selectSite")} description={t("connectors.selectSiteHelp")}
    action={<Button asChild variant="outline"><Link href="/projects">{t("connectors.selectSite")}</Link></Button>} />
  return children(currentSite.id, `${auth.user.id}:${currentSite.id}`)
}