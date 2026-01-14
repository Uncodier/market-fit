"use client"

import { useState, useEffect } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Copy, ChevronDown, ChevronRight, Trash2, Play, PlusCircle } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { Label } from "@/app/components/ui/label"
import { Checkbox } from "@/app/components/ui/checkbox"
import { CreateEndpointDialog } from "@/app/components/webhooks/create-endpoint-dialog"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { apiClient } from "@/app/services/api-client-service"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import { createClient as createSbClient } from "@/lib/supabase/client"
import { TestEndpointDialog } from "@/app/components/webhooks/test-endpoint-dialog"
import { ChannelsSection } from "@/app/components/integrations/channels-section"
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookSubscriptions,
  upsertSubscription,
  type WebhookEndpoint,
  type WebhookSubscription,
  type WebhookEventType
} from "@/lib/webhooks"
import { useAuth } from "@/app/hooks/use-auth"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"

function IntegrationsSkeleton() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-1/3" />
        </CardContent>
      </Card>
    </div>
  )
}

const SUPPORTED_EVENTS: WebhookEventType[] = [
  "task.created",
  "task.updated",
  "message.created",
  "lead.created",
  "lead.updated",
  "lead.deleted",
]

// Section configurations for quick navigation
const getInitialWebhooksSections = (): QuickNavSection[] => [
  { 
    id: "outbound-webhooks", 
    title: "Outbound Webhooks",
    children: []
  },
  { id: "workflow-webhooks", title: "Workflow Webhooks" },
]

const channelsSections: QuickNavSection[] = [
  { id: "email-channel", title: "Email Channel" },
  { id: "whatsapp-channel", title: "WhatsApp Channel" },
]

export default function IntegrationsPage() {
  const { currentSite, isLoading } = useSite()
  const { user } = useAuth()
  const [activeSegment, setActiveSegment] = useState("webhooks")

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newName, setNewName] = useState("")
  const [newTargetUrl, setNewTargetUrl] = useState("")
  const [newSecret, setNewSecret] = useState("")
  const [webhooksSections, setWebhooksSections] = useState<QuickNavSection[]>(getInitialWebhooksSections())

  // Test dialog state
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [testEndpointId, setTestEndpointId] = useState<string | null>(null)
  const [testOperation, setTestOperation] = useState<'INSERT' | 'UPDATE' | 'DELETE'>('INSERT')
  const [testTable, setTestTable] = useState<string>('tasks')
  const [testRecords, setTestRecords] = useState<any[]>([])
  const [testRecordId, setTestRecordId] = useState<string>("")
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"}/api/workflows/webhook`

  // Update webhooks sections when endpoints change
  useEffect(() => {
    if (activeSegment === "webhooks" && endpoints.length > 0) {
      const endpointsData = endpoints.map((ep, index) => ({
        id: `webhook-endpoint-${index}`,
        title: ep.name || `Endpoint ${index + 1}`,
      }));
      
      setWebhooksSections([
        {
          id: "outbound-webhooks",
          title: "Outbound Webhooks",
          children: endpointsData
        },
        { id: "workflow-webhooks", title: "Workflow Webhooks" },
      ]);
    }
  }, [activeSegment, endpoints]);

  // Get current sections based on active segment
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeSegment) {
      case "webhooks":
        return webhooksSections
      case "channels":
        return channelsSections
      default:
        return []
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success("Webhook URL copied to clipboard")
    } catch (e) {
      toast.error("Failed to copy URL")
    }
  }

  const loadData = async () => {
    if (!currentSite) return
    try {
      const list = await listWebhookEndpoints(currentSite.id)
      // Sort so newest first (assuming they have created_at or similar)
      setEndpoints(list)
      if (list.length > 0) {
        setSelectedEndpointId((prev) => prev ?? list[0].id)
      } else {
        setSelectedEndpointId(null)
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to load webhook endpoints")
    }
  }

  useEffect(() => {
    loadData()
  }, [currentSite?.id])

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
        toast.error("Failed to load subscriptions")
      }
    }
    loadSubs()
  }, [selectedEndpointId])

  const handleCreateEndpoint = async () => {
    if (!currentSite || !user) {
      toast.error("Select a site and sign in")
      return
    }
    if (!newName || !newTargetUrl) {
      toast.error("Name and URL are required")
      return
    }
    try {
      setIsSubmitting(true)
      const ep = await createWebhookEndpoint({
        site_id: currentSite.id,
        created_by: user.id,
        name: newName,
        target_url: newTargetUrl,
        secret: newSecret || undefined
      })
      toast.success("Endpoint created")
      setNewName("")
      setNewTargetUrl("")
      setNewSecret("")
      // Add the new endpoint at the beginning of the list
      setEndpoints(prev => [ep, ...prev])
      setSelectedEndpointId(ep.id)
    } catch (e: any) {
      toast.error(e?.message || "Failed to create endpoint")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleEvent = async (event: WebhookEventType, checked: boolean) => {
    if (!currentSite || !selectedEndpointId) return
    try {
      setIsSubmitting(true)
      await upsertSubscription(currentSite.id, selectedEndpointId, event, checked)
      setSubscriptions((prev) => ({ ...prev, [event]: checked }))
      toast.success("Subscription updated")
    } catch (e: any) {
      toast.error(e?.message || "Failed to update subscription")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!currentSite) return
    try {
      setIsSubmitting(true)
      await deleteWebhookEndpoint(endpointId, currentSite.id)
      toast.success("Endpoint deleted")
      await loadData()
      setSelectedEndpointId((prev) => (prev === endpointId ? null : prev))
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete endpoint")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestEndpoint = async (endpointId: string, opts?: { operation?: 'INSERT' | 'UPDATE' | 'DELETE', table?: string, record?: any }) => {
    if (!currentSite) return
    try {
      setIsSubmitting(true)
      const op = (opts?.operation || 'INSERT') as 'INSERT' | 'UPDATE' | 'DELETE'
      const table = (opts?.table || 'tasks') as string

      const res = await apiClient.post('/api/webhooks/test', {
        endpoint_id: endpointId,
        site_id: currentSite.id,
        operation: op,
        table
      })
      if (!res.success) {
        throw new Error(res.error?.message || 'Request failed')
      }
      toast.success("Test webhook sent")
    } catch (e: any) {
      toast.error(e?.message || "Failed to send test webhook")
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
      if (!isTestOpen || !currentSite) return
      try {
        setIsLoadingRecords(true)
        const supabase = createSbClient()
        let data: any[] | null = null
        let error: any = null

        if (testTable === 'messages') {
          // messages does not have site_id; filter via related leads
          const resp = await supabase
            .from('messages')
            .select('id, content, created_at, lead_id, leads!inner(site_id)')
            .eq('leads.site_id', currentSite.id)
            .order('created_at', { ascending: false })
            .limit(50)
          data = resp.data as any[] | null
          error = resp.error
        } else {
          const resp = await supabase
            .from(testTable)
            .select('*')
            .eq('site_id', currentSite.id)
            .order('created_at', { ascending: false })
            .limit(50)
          data = resp.data as any[] | null
          error = resp.error
        }
        if (error) {
          console.error(error)
          toast.error('Failed to load records')
          setTestRecords([])
        } else {
          setTestRecords(data || [])
        }
      } catch (e) {
        console.error(e)
        toast.error('Failed to load records')
        setTestRecords([])
      } finally {
        setIsLoadingRecords(false)
      }
    }
    loadRecords()
  }, [isTestOpen, testTable, currentSite?.id])

  if (isLoading) {
    return (
      <div className="flex-1">
        <StickyHeader>
          <div className="flex items-center justify-between px-16 w-full">
            <Tabs value="webhooks" className="w-auto">
              <TabsList>
                <TabsTrigger value="webhooks" className="whitespace-nowrap">Webhooks</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-16">
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
        <p className="text-gray-500">No site selected</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-auto">
            <TabsList className="flex">
              <TabsTrigger value="webhooks" className="whitespace-nowrap">Webhooks</TabsTrigger>
              <TabsTrigger value="channels" className="whitespace-nowrap">Channels</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>
      <div className="py-8 pb-16">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-16">
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
                    toast.error('Select a record')
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
                    <h2 className="text-2xl font-semibold">Outbound Webhooks</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Webhooks send real-time POST requests to your endpoint when selected events occur
                    </p>
                  </div>
                  <CreateEndpointDialog onSuccess={loadData} triggerLabel="Add Webhook" />
                </div>

                {/* Webhook Endpoint Cards */}
                {endpoints.map((ep, index) => {
                  const isExpanded = selectedEndpointId === ep.id
                  return (
                    <Card key={ep.id} id={`webhook-endpoint-${index}`} className="border border-border">
                      {/* Collapsible Header */}
                      <CardHeader 
                        className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedEndpointId((prev) => (prev === ep.id ? null : ep.id))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg font-semibold truncate">{ep.name}</CardTitle>
                            <p className="text-sm text-muted-foreground truncate mt-1">{ep.target_url}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      {/* Collapsible Content */}
                      {isExpanded && (
                        <>
                          <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t">
                            <div className="space-y-2">
                              <Label>Subscribed Events</Label>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {SUPPORTED_EVENTS.map((evt) => (
                                  <label key={evt} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={!!subscriptions[evt]}
                                      onCheckedChange={(checked: boolean) => handleToggleEvent(evt, !!checked)}
                                      disabled={isSubmitting}
                                    />
                                    <span className="capitalize">{evt.replace('.', ' ')}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Endpoint ID</Label>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono bg-muted px-2 py-1 rounded">{ep.id}</span>
                              </div>
                            </div>
                          </CardContent>

                          {/* Card Footer with individual buttons */}
                          <ActionFooter>
                            <div className="flex items-center gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isSubmitting}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Endpoint
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this webhook endpoint "{ep.name}"? This action cannot be undone and all subscriptions will be removed.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteEndpoint(ep.id)}
                                      className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                                    >
                                      Delete Endpoint
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => openTestDialog(ep.id)}
                                disabled={isSubmitting}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Test Endpoint
                              </Button>
                            </div>
                          </ActionFooter>
                        </>
                      )}
                    </Card>
                  )
                })}
              </div>

              <Card id="workflow-webhooks">
                <CardHeader>
                  <CardTitle>Workflow Webhooks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Use this endpoint to receive real-time workflow events (response received, completed, failed).
                    </div>
                    {/* Single full-width row for the input */}
                    <Input value={webhookUrl} readOnly className="bg-gray-50 dark:bg-gray-900" />
                    <div className="text-xs text-muted-foreground">
                      Secure this endpoint in production. Set `NEXT_PUBLIC_APP_URL` correctly.
                    </div>
                  </div>
                </CardContent>
                <ActionFooter>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" /> Copy URL
                  </Button>
                </ActionFooter>
              </Card>
            </>
          )}

          {activeSegment === "channels" && (
            <ChannelsSection />
          )}
            </div>
          </div>
          <QuickNav sections={getCurrentSections()} />
        </div>
      </div>
    </div>
  )
}


