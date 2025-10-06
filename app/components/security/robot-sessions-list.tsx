import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Settings, Trash2, Clock, ChevronDown, ChevronRight, Shield, Globe, AlertCircle, AppWindow, Bot } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Card, CardContent } from "@/app/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"
import { createClient } from "@/lib/supabase/client"

interface AutomationSession {
  id: string
  name: string
  description?: string
  domain: string
  auth_type: string
  browser_type: string
  user_agent?: string
  viewport: { width: number; height: number }
  last_used_at?: string
  usage_count: number
  is_valid: boolean
  expires_at?: string
  created_at: string
  updated_at: string
}

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy')
}

function formatDateTime(date: string) {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

// Component for individual robot session row
function RobotSessionRow({
  session,
  isExpanded,
  onToggle,
  onDelete,
  isSubmitting
}: {
  session: AutomationSession;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isSubmitting: boolean;
}) {
  return (
    <Collapsible
      key={session.id}
      open={isExpanded}
      onOpenChange={() => {}} // Disable automatic toggle
      className="w-full"
    >
      <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
        <div 
          className="flex items-center hover:bg-muted/50 transition-colors w-full cursor-pointer"
          onClick={() => onToggle(session.id)}
        >
          <CardContent className="flex-1 p-4 w-full">
            <div className="flex items-center gap-4">
              {/* Expand/Collapse Icon at the beginning */}
              <div className="flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(session.id);
                  }}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{session.name}</h3>
                <p className="text-sm text-muted-foreground/80 truncate">
                  <span className="font-mono">{session.domain}</span> • Created {formatDate(session.created_at)}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                  <Badge variant={session.is_valid ? 'default' : 'destructive'}>
                    {session.is_valid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
                
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Usage</p>
                  <p className="text-sm font-medium">{session.usage_count} times</p>
                </div>
                
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Type</p>
                  <p className="text-sm font-medium capitalize">{session.auth_type}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-6 px-6 border-t bg-muted/30" onClick={(e) => e.stopPropagation()}>
            <div className="grid gap-6 pt-6">
              {/* Session Info */}
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Authentication Session
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      This session contains browser authentication data that can be reused by makinas to access {session.domain} without re-authenticating.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Session Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Session Details</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Domain</span>
                      <span className="font-mono font-medium">{session.domain}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Auth Type</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {session.auth_type}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Browser</span>
                      <span className="font-medium capitalize">{session.browser_type}</span>
                    </div>
                  </div>
                </div>

                {/* Browser Configuration */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AppWindow className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Browser Config</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Viewport</span>
                      <span className="font-mono font-medium">
                        {session.viewport.width} × {session.viewport.height}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Usage Count</span>
                      <span className="font-mono font-medium">{session.usage_count}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {session.description && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Description</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{session.description}</p>
                </div>
              )}

              {/* Usage Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Timeline</h4>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm font-medium">{formatDateTime(session.created_at)}</span>
                    </div>
                  </div>
                  {session.last_used_at && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Last used</span>
                        <span className="text-sm font-medium">{formatDateTime(session.last_used_at)}</span>
                      </div>
                    </div>
                  )}
                  {session.expires_at && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Expires</span>
                        <span className="text-sm font-medium">{formatDateTime(session.expires_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-[10px]">#</span>
                  <span className="font-mono">{session.id}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(session.id)}
                  disabled={isSubmitting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete Session
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function RobotSessionsList() {
  const [sessions, setSessions] = useState<AutomationSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const { currentSite } = useSite()

  const loadSessions = async () => {
    if (!currentSite) return
    
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('automation_auth_sessions')
        .select('*')
        .eq('site_id', currentSite.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setSessions(data || [])
    } catch (error) {
      console.error("Error loading robot sessions:", error)
      toast.error("Failed to load robot sessions")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [currentSite])

  const handleDelete = async (sessionId: string) => {
    if (!currentSite) return
    
    try {
      setIsSubmitting(true)
      const supabase = createClient()
      
      const { error } = await supabase
        .from('automation_auth_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('site_id', currentSite.id)

      if (error) {
        throw error
      }

      toast.success("Robot session deleted successfully")
      loadSessions()
    } catch (error) {
      console.error("Error deleting robot session:", error)
      toast.error("Failed to delete robot session")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRow = (sessionId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }))
  }

  if (!currentSite) {
    return (
      <EmptyCard
        icon={<Bot className="h-10 w-10 text-muted-foreground" />}
        title="Select a site"
        description="Please select a site to manage robot sessions"
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            {sessions.map((session) => (
              <RobotSessionRow
                key={session.id}
                session={session}
                isExpanded={expandedRows[session.id] || false}
                onToggle={toggleRow}
                onDelete={handleDelete}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
          <EmptyCard
            icon={<Bot className="h-10 w-10 text-muted-foreground" />}
            title="No robot sessions"
            description="Robot sessions will appear here when your automation instances save authentication data"
          />
        </div>
      )}
    </div>
  )
}
