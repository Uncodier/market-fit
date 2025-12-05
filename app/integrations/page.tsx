"use client"

import { useState, useEffect } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Copy, ChevronDown, ChevronRight, Trash2, Play } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { Label } from "@/app/components/ui/label"
import { Checkbox } from "@/app/components/ui/checkbox"
import { CreateEndpointDialog } from "@/app/components/webhooks/create-endpoint-dialog"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"
import { CustomSelect, Option } from "@/app/components/ui/custom-select"
import { apiClient } from "@/app/services/api-client-service"
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

  // Test dialog state
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [testEndpointId, setTestEndpointId] = useState<string | null>(null)
  const [testOperation, setTestOperation] = useState<'INSERT' | 'UPDATE' | 'DELETE'>('INSERT')
  const [testTable, setTestTable] = useState<string>('tasks')
  const [testRecords, setTestRecords] = useState<any[]>([])
  const [testRecordId, setTestRecordId] = useState<string>("")
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"}/api/workflows/webhook`

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
      await loadData()
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
        <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
          <IntegrationsSkeleton />
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
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
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

              <Card>
                <CardHeader>
                  <CardTitle>Outbound Webhooks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-sm text-muted-foreground">
                    Webhooks send real-time POST requests to your endpoint when selected events occur. Enable the events you want below. Currently supported: {SUPPORTED_EVENTS.join(", ")}.
                  </div>
                  {endpoints.length > 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {endpoints.map((ep) => {
                          const isExpanded = selectedEndpointId === ep.id
                          return (
                            <Collapsible key={ep.id} open={isExpanded} onOpenChange={() => {}} className="w-full">
                              <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
                                <div
                                  className="flex items-center hover:bg-muted/50 transition-colors w-full cursor-pointer"
                                  onClick={() => setSelectedEndpointId((prev) => (prev === ep.id ? null : ep.id))}
                                >
                                  <CardContent className="flex-1 p-4 w-full">
                                    <div className="flex items-center gap-4">
                                      <div className="flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedEndpointId((prev) => (prev === ep.id ? null : ep.id))
                                          }}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-lg truncate">{ep.name}</h3>
                                        <p className="text-sm text-muted-foreground/80 truncate">{ep.target_url}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </div>

                                <CollapsibleContent>
                                  <CardContent className="pt-0 pb-6 px-6 border-t bg-muted/30" onClick={(e) => e.stopPropagation()}>
                                    <div className="space-y-2 pt-6">
                                      <Label>Subscribed events</Label>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {SUPPORTED_EVENTS.map((evt) => (
                                          <label key={evt} className="flex items-center gap-2 text-sm">
                                            <Checkbox
                                              checked={!!subscriptions[evt]}
                                              onCheckedChange={(checked: boolean) => handleToggleEvent(evt, !!checked)}
                                              disabled={isSubmitting || selectedEndpointId !== ep.id}
                                            />
                                            <span className="capitalize">{evt.replace('.', ' ')}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-4 border-t mt-6">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="text-[10px]">#</span>
                                        <span className="font-mono">{ep.id}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="default"
                                          size="sm"
                                          onClick={() => openTestDialog(ep.id)}
                                          disabled={isSubmitting}
                                        >
                                          <Play className="h-3.5 w-3.5 mr-1.5" />
                                          Test endpoint
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteEndpoint(ep.id)}
                                          disabled={isSubmitting}
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                          Delete endpoint
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </CollapsibleContent>
                              </Card>
                            </Collapsible>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
                <ActionFooter>
                  <CreateEndpointDialog onSuccess={loadData} triggerLabel="New Webhook" />
                </ActionFooter>
              </Card>

              <Card>
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
    </div>
  )
}


