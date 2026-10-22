"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import {
  listWebhookEndpoints,
  deleteWebhookEndpoint,
  listWebhookSubscriptions,
  upsertSubscription,
  type WebhookEndpoint,
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
  const { t } = useLocalization()
  const translateRef = useRef(t)
  useEffect(() => { translateRef.current = t }, [t])
  const { currentSite, isLoading } = useSite()
  const siteId = currentSite?.id
  const [activeSegment, setActiveSegment] = useState("webhooks")

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Test dialog state
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [testEndpointId, setTestEndpointId] = useState<string | null>(null)
  const [testOperation, setTestOperation] = useState<'INSERT' | 'UPDATE' | 'DELETE'>('INSERT')
  const [testTable, setTestTable] = useState<string>('tasks')
  const [testRecords, setTestRecords] = useState<Record<string, unknown>[]>([])
  const [testRecordId, setTestRecordId] = useState<string>("")
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

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

  const loadData = useCallback(async () => {
    if (!siteId) return
    try {
      const list = await listWebhookEndpoints(siteId)
      // Sort so newest first (assuming they have created_at or similar)
      setEndpoints(list)
      if (list.length > 0) {
        setSelectedEndpointId((prev) => prev ?? list[0].id)
      } else {
        setSelectedEndpointId(null)
      }
    } catch (e) {
      console.error(e)
      toast.error(translateRef.current("operations.integrations.loadEndpointsFailed"))
    }
  }, [siteId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const loadSubs = async () => {
      if (!selectedEndpointId) {
        setSubscriptions({})
        return
      }
      try {
        const subs = await listWebhookSubscriptions(selectedEndpointId)
        const map: Record<string, boolean> = {}
        subs.forEach((s) => { map[s.event_type] = s.is_active })
        setSubscriptions(map)
      } catch (e) {
        console.error(e)
        toast.error(translateRef.current("operations.integrations.loadSubscriptionsFailed"))
      }
    }
    loadSubs()
  }, [selectedEndpointId])

  const handleToggleEvent = async (event: WebhookEventType, checked: boolean) => {
    if (!currentSite || !selectedEndpointId) return
    try {
      setIsSubmitting(true)
      await upsertSubscription(currentSite.id, selectedEndpointId, event, checked)
      setSubscriptions((prev) => ({ ...prev, [event]: checked }))
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
      await loadData()
      setSelectedEndpointId((prev) => (prev === endpointId ? null : prev))
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
    const loadRecords = async () => {
      if (!isTestOpen || !siteId) return
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
            .limit(50)
          data = resp.data as Record<string, unknown>[] | null
          error = resp.error
        } else {
          const resp = await supabase
            .from(testTable)
            .select('*')
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(50)
          data = resp.data as Record<string, unknown>[] | null
          error = resp.error
        }
        if (error) {
          console.error(error)
          toast.error(translateRef.current("operations.integrations.loadRecordsFailed"))
          setTestRecords([])
        } else {
          setTestRecords(data || [])
        }
      } catch (e) {
        console.error(e)
        toast.error(translateRef.current("operations.integrations.loadRecordsFailed"))
        setTestRecords([])
      } finally {
        setIsLoadingRecords(false)
      }
    }
    loadRecords()
  }, [isTestOpen, testTable, siteId])

  if (isLoading) {
    return (
      <div className="flex-1">
        <StickyHeader>
          <div className="flex items-center justify-between px-4 md:px-16 w-full">
            <Tabs value="webhooks" className="w-auto">
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                <TabsTrigger value="webhooks" className="text-xs rounded-full px-4 whitespace-nowrap">{t("operations.integrations.webhooks")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-4 md:px-16">
              <IntegrationsSkeleton />
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
              <TestEndpointDialog
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
              />

              <div id="outbound-webhooks" className="space-y-6">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">{t("operations.integrations.outboundWebhooks")}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("operations.integrations.outboundDescription")}
                    </p>
                  </div>
                  <CreateEndpointDialog onSuccess={loadData} triggerLabel={t("operations.integrations.addWebhook")} />
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
                      subscriptions={subscriptions}
                      isSubmitting={isSubmitting}
                      onToggle={() => setSelectedEndpointId((prev) => (prev === ep.id ? null : ep.id))}
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
            </div>
          </div>
          <QuickNav sections={getCurrentSections()} />
        </div>
      </div>
    </div>
  )
}


