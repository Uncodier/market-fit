"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Copy } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { CreateEndpointDialog } from "@/app/components/webhooks/create-endpoint-dialog"
import { WebhookEndpointCard } from "@/app/components/webhooks/webhook-endpoint-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { apiClient } from "@/app/services/api-client-service"
import { createClient as createSbClient } from "@/lib/supabase/client"
import { TestEndpointDialog } from "@/app/components/webhooks/test-endpoint-dialog"
import { ChannelsSection } from "@/app/components/integrations/channels-section"
import { ComposioSection } from "@/app/components/settings/ComposioSection"
import { MarketplaceConfigurationCards } from "./components/MarketplaceConfigurationCards"
import { OpenRouterSection } from "./components/OpenRouterSection"
import { OpenRouterLoading } from "./components/OpenRouterLoading"
import {
  listWebhookEndpoints,
  deleteWebhookEndpoint,
  listWebhookSubscriptions,
  upsertSubscription,
  type WebhookEndpointSummary,
} from "@/lib/webhooks"
import {
  buildWebhookTestRequest,
  type WebhookEventType,
  type WebhookTestOperation,
} from "@/lib/webhook-events"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"

function providerErrorMessage(error: unknown): string | undefined {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : undefined
}

function IntegrationsSkeleton() {
  return (
    <div className="space-y-8">
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>
            <Skeleton className="h-6 w-1/4" />
          </SectionCardTitle>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-1/3" />
        </SectionCardContent>
      </SectionCard>
    </div>
  )
}

export default function IntegrationsPage() {
  const { currentSite, isLoading } = useSite()
  const [activeSegment, setActiveSegment] = useState("webhooks")
  // Tab selection survives hydration; endpoint IDs, drafts and test records do
  // not survive leaving the ready webhooks screen.
  const webhookScope = !isLoading && activeSegment === 'webhooks' ? currentSite?.id : undefined
  return <IntegrationsWorkspace key={currentSite?.id} webhookScope={webhookScope} currentSite={currentSite} isLoading={isLoading}
    activeSegment={activeSegment} setActiveSegment={setActiveSegment} />
}

function IntegrationsWorkspace({ webhookScope: siteId, currentSite, isLoading, activeSegment, setActiveSegment }: {
  webhookScope?: string;
  currentSite: ReturnType<typeof useSite>["currentSite"]; isLoading: boolean;
  activeSegment: string; setActiveSegment: (value: string) => void;
}) {
  const { t } = useLocalization()
  const translateRef = useRef(t)
  useEffect(() => { translateRef.current = t }, [t])

  const [endpoints, setEndpoints] = useState<WebhookEndpointSummary[]>([])
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(value => value + 1), [])
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const subscriptionScope = useMemo(() => ({ siteId, endpointId: selectedEndpointId }), [siteId, selectedEndpointId])
  const [subscriptions, setSubscriptions] = useState<{ scope: typeof subscriptionScope; events: Record<string, boolean> } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Test dialog state
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [testEndpointId, setTestEndpointId] = useState<string | null>(null)
  const [testOperation, setTestOperation] = useState<'INSERT' | 'UPDATE' | 'DELETE'>('INSERT')
  const [testTable, setTestTable] = useState<string>('tasks')
  const [testRecords, setTestRecords] = useState<Record<string, unknown>[]>([])
  const [testRecordId, setTestRecordId] = useState<string>("")
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

  const [previousWebhookScope, setPreviousWebhookScope] = useState(siteId)
  if (previousWebhookScope !== siteId) {
    setPreviousWebhookScope(siteId)
    setEndpoints([])
    setSelectedEndpointId(null)
    setSubscriptions(null)
    setIsTestOpen(false)
    setTestEndpointId(null)
    setTestRecords([])
    setTestRecordId("")
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"}/api/workflows/webhook`

  // Navigation is display-only; changing locale must not reload endpoints.
  const webhooksSections: QuickNavSection[] = [
    {
      id: "outbound-webhooks",
      title: t("operations.integrations.outboundWebhooks"),
      children: endpoints.map((ep, index) => ({
        id: `webhook-endpoint-${index}`,
        title: ep.name || t("operations.integrations.endpoint", { number: index + 1 }),
      })),
    },
    { id: "workflow-webhooks", title: t("operations.integrations.workflowWebhooks") },
  ]
  const channelsSections: QuickNavSection[] = [
    { id: "agent-email-channel", title: t("operations.integrations.agentEmail") },
    { id: "email-channel", title: t("operations.integrations.smtpEmail") },
    { id: "whatsapp-channel", title: "WhatsApp (Twilio)" },
  ]

  // Get current sections based on active segment
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeSegment) {
      case "webhooks":
        return webhooksSections
      case "channels":
        return channelsSections
      case "integrations":
        return [
          { id: "marketplace-rappi", title: "Rappi" },
          { id: "marketplace-uber_eats", title: "Uber Eats" },
          { id: "composio-integration", title: "Composio" }
        ]
      case "models":
        return [{ id: "openrouter-integration", title: "OpenRouter" }]
      default:
        return []
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success(t("operations.integrations.urlCopied"))
    } catch {
      toast.error(t("operations.integrations.copyFailed"))
    }
  }

  useEffect(() => {
    if (!siteId) return
    const controller = new AbortController()
    void listWebhookEndpoints(siteId, controller.signal).then(list => {
      if (controller.signal.aborted) return
      setEndpoints(list)
      setSelectedEndpointId(previous => list.some(ep => ep.id === previous) ? previous : list[0]?.id ?? null)
    }).catch(() => {
      if (controller.signal.aborted) return
      setEndpoints([])
      setSelectedEndpointId(null)
      toast.error(translateRef.current("operations.integrations.loadEndpointsFailed"))
    })
    return () => controller.abort()
  }, [siteId, revision])

  useEffect(() => {
    const { siteId, endpointId } = subscriptionScope
    if (!siteId || !endpointId) return
    const controller = new AbortController()
    void listWebhookSubscriptions(siteId, endpointId, controller.signal).then(subs => {
      if (controller.signal.aborted) return
      setSubscriptions({ scope: subscriptionScope, events: Object.fromEntries(subs.map(s => [s.event_type, s.is_active])) })
    }).catch(() => {
      if (!controller.signal.aborted) toast.error(translateRef.current("operations.integrations.loadSubscriptionsFailed"))
    })
    return () => controller.abort()
  }, [subscriptionScope])

  const handleToggleEvent = async (event: WebhookEventType, checked: boolean) => {
    if (!siteId || !selectedEndpointId || subscriptions?.scope !== subscriptionScope) return
    try {
      setIsSubmitting(true)
      await upsertSubscription(siteId, selectedEndpointId, event, checked)
      setSubscriptions(prev => prev?.scope === subscriptionScope ? { ...prev, events: { ...prev.events, [event]: checked } } : prev)
      toast.success(t("operations.integrations.subscriptionUpdated"))
    } catch (e: unknown) {
      toast.error(providerErrorMessage(e) || t("operations.integrations.updateSubscriptionFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!currentSite) return
    try {
      setIsSubmitting(true)
      await deleteWebhookEndpoint(endpointId, currentSite.id)
      toast.success(t("operations.integrations.endpointDeleted"))
      reload()
    } catch (e: unknown) {
      toast.error(providerErrorMessage(e) || t("operations.integrations.deleteEndpointFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestEndpoint = async (endpointId: string, opts?: { operation?: WebhookTestOperation, table?: string, record?: unknown }) => {
    if (!currentSite) return
    try {
      setIsSubmitting(true)
      const op = (opts?.operation || 'INSERT') as WebhookTestOperation
      const table = (opts?.table || 'tasks') as string

      const res = await apiClient.post('/api/webhooks/test', buildWebhookTestRequest({
        endpointId,
        siteId: currentSite.id,
        operation: op,
        table,
        record: opts?.record,
      }))
      if (!res.success) {
        throw new Error(res.error?.message || t("operations.integrations.requestFailed"))
      }
      toast.success(t("operations.integrations.testSent"))
    } catch (e: unknown) {
      toast.error(providerErrorMessage(e) || t("operations.integrations.testFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openTestDialog = (endpointId: string) => {
    setTestEndpointId(endpointId)
    setTestOperation('INSERT')
    setTestTable('tasks')
    setTestRecords([])
    setTestRecordId("")
    setIsTestOpen(true)
  }
  // Load real records for the selected table filtered by current site
  useEffect(() => {
    if (!isTestOpen || !siteId) return
    const controller = new AbortController()
    const loadRecords = async () => {
      try {
        setIsLoadingRecords(true)
        const supabase = createSbClient()
        let data: Record<string, unknown>[] | null = null
        let error: unknown = null

        if (testTable === 'messages') {
          // messages does not have site_id; filter via related leads
          const resp = await supabase
            .from('messages')
            .select('id, content, created_at, lead_id, leads!inner(site_id)')
            .eq('leads.site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(50).abortSignal(controller.signal)
          data = resp.data as Record<string, unknown>[] | null
          error = resp.error
        } else {
          const resp = await supabase
            .from(testTable)
            .select('*')
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(50).abortSignal(controller.signal)
          data = resp.data as Record<string, unknown>[] | null
          error = resp.error
        }
        if (controller.signal.aborted) return
        if (error) {
          console.error(error)
          toast.error(translateRef.current("operations.integrations.loadRecordsFailed"))
          setTestRecords([])
        } else {
          setTestRecords(data || [])
        }
      } catch (e) {
        if (controller.signal.aborted) return
        console.error(e)
        toast.error(translateRef.current("operations.integrations.loadRecordsFailed"))
        setTestRecords([])
      } finally {
        if (!controller.signal.aborted) setIsLoadingRecords(false)
      }
    }
    loadRecords()
    return () => controller.abort()
  }, [isTestOpen, testTable, siteId])

  if (isLoading) {
    return (
      <div className="flex-1">
        <StickyHeader>
          <div className="flex items-center justify-between px-4 md:px-16 w-full">
            <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-auto">
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                <TabsTrigger value="webhooks" className="text-xs rounded-full px-4 whitespace-nowrap">{t("operations.integrations.webhooks")}</TabsTrigger>
                <TabsTrigger value="channels" className="text-xs rounded-full px-4 whitespace-nowrap">{t("operations.integrations.channels")}</TabsTrigger>
                <TabsTrigger value="integrations" className="text-xs rounded-full px-4 whitespace-nowrap">{t("layout.sidebar.integrations")}</TabsTrigger>
                <TabsTrigger value="models" className="text-xs rounded-full px-4 whitespace-nowrap">Models</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-4 md:px-16">
              {activeSegment === "models" ? <OpenRouterLoading /> : <IntegrationsSkeleton />}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">{t("settings.empty.noSite")}</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-4 md:px-16 w-full">
          <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-auto">
            <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
              <TabsTrigger value="webhooks" className="text-xs rounded-full px-4 whitespace-nowrap">{t("operations.integrations.webhooks")}</TabsTrigger>
              <TabsTrigger value="channels" className="text-xs rounded-full px-4 whitespace-nowrap">{t("operations.integrations.channels")}</TabsTrigger>
              <TabsTrigger value="integrations" className="text-xs rounded-full px-4 whitespace-nowrap">{t("layout.sidebar.integrations")}</TabsTrigger>
              <TabsTrigger value="models" className="text-xs rounded-full px-4 whitespace-nowrap">Models</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>
      <div className="py-8 pb-16">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-4 md:px-16">
            <div className="space-y-8">
          {activeSegment === "webhooks" && (
            <>
              {isTestOpen && <TestEndpointDialog
                open={isTestOpen}
                onOpenChange={setIsTestOpen}
                operation={testOperation}
                onChangeOperation={(op) => setTestOperation(op)}
                table={testTable}
                onChangeTable={(t) => { setTestTable(t); setTestRecordId(""); setTestRecords([]) }}
                recordId={testRecordId}
                onChangeRecordId={setTestRecordId}
                records={testRecords}
                isLoadingRecords={isLoadingRecords}
                isSubmitting={isSubmitting}
                onSend={() => {
                  if (!testEndpointId) return
                  const selected = testRecords.find((r) => r.id === testRecordId)
                  if ((testOperation === 'UPDATE' || testOperation === 'DELETE') && !selected) {
                    toast.error(t("operations.integrations.selectRecord"))
                    return
                  }
                  setIsTestOpen(false)
                  void handleTestEndpoint(testEndpointId, { operation: testOperation, table: testTable, record: selected })
                }}
              />}

              <div id="outbound-webhooks" className="space-y-6">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">{t("operations.integrations.outboundWebhooks")}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("operations.integrations.outboundDescription")}
                    </p>
                  </div>
                  <CreateEndpointDialog onSuccess={reload} triggerLabel={t("operations.integrations.addWebhook")} />
                </div>

                {/* Webhook Endpoint Cards */}
                {endpoints.map((ep, index) => {
                  const isExpanded = selectedEndpointId === ep.id
                  return (
                    <WebhookEndpointCard
                      key={ep.id}
                      endpoint={ep}
                      index={index}
                      isExpanded={isExpanded}
                      subscriptions={isExpanded && subscriptions?.scope === subscriptionScope ? subscriptions.events : {}}
                      subscriptionsReady={isExpanded && subscriptions?.scope === subscriptionScope}
                      isSubmitting={isSubmitting}
                      onToggle={() => {
                        setSelectedEndpointId(prev => prev === ep.id ? null : ep.id)
                      }}
                      onToggleEvent={(event, checked) => void handleToggleEvent(event, checked)}
                      onDelete={() => void handleDeleteEndpoint(ep.id)}
                      onTest={() => openTestDialog(ep.id)}
                    />
                  )
                })}
              </div>

              <SectionCard id="workflow-webhooks">
                <SectionCardHeader>
                  <SectionCardTitle>{t("operations.integrations.workflowWebhooks")}</SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {t("operations.integrations.workflowDescription")}
                    </div>
                    {/* Single full-width row for the input */}
                    <Input value={webhookUrl} readOnly aria-label={t("operations.integrations.workflowUrl")} className="bg-gray-50 dark:bg-gray-900" />
                    <div className="text-xs text-muted-foreground">
                      {t("operations.integrations.secureEndpoint")}
                    </div>
                  </div>
                </SectionCardContent>
                <ActionFooter>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" /> {t("operations.integrations.copyUrl")}
                  </Button>
                </ActionFooter>
              </SectionCard>
            </>
          )}

          {activeSegment === "channels" && (
            <ChannelsSection />
          )}

          {activeSegment === "integrations" && (
            <div className="space-y-6">
              <MarketplaceConfigurationCards key={currentSite.id} siteId={currentSite.id} />
              <ComposioSection 
                active={true}
                siteId={currentSite.id}
              />
            </div>
          )}
          {activeSegment === "models" && (
            <OpenRouterSection siteId={currentSite.id} />
          )}
            </div>
          </div>
          <QuickNav sections={getCurrentSections()} />
        </div>
      </div>
    </div>
  )
}


