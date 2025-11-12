"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Bot, Shield, Globe } from "@/app/components/ui/icons"
import { Card, CardContent } from "@/app/components/ui/card"
import { format } from "date-fns"

interface AutomationSession {
  id: string
  name: string
  description?: string
  domain: string
  auth_type: string
  browser_type: string
  is_valid: boolean
  usage_count: number
  created_at: string
  last_used_at?: string
}

interface AuthenticateSessionsModalProps {
  isOpen: boolean
  onClose: () => void
  instanceId: string
}

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy')
}

export function AuthenticateSessionsModal({
  isOpen,
  onClose,
  instanceId,
}: AuthenticateSessionsModalProps) {
  const [sessions, setSessions] = useState<AutomationSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null)
  const { currentSite } = useSite()

  useEffect(() => {
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
        console.error("Error loading auth sessions:", error)
        toast.error("Failed to load auth sessions")
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen && currentSite) {
      loadSessions()
    }
  }, [isOpen, currentSite])

  const handleAuthenticate = async (sessionId: string) => {
    if (!instanceId) {
      toast.error("No robot instance selected")
      return
    }

    try {
      setIsAuthenticating(sessionId)
      const { apiClient } = await import('@/app/services/api-client-service')

      const response = await apiClient.post('/api/robots/instance/authenticate', {
        instance_id: instanceId,
        automation_auth_sessions_id: sessionId
      })

      if (response.success) {
        toast.success('Authentication session applied successfully')
        onClose()
      } else {
        const errorMessage = response.error?.message || 'Failed to authenticate session'
        console.error('API Error authenticating session:', response.error || response)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error authenticating session:', error)
      let errorMessage = "Failed to authenticate session"

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = "Network error - please check your connection and try again"
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out - please try again"
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorMessage = "Permission denied - please refresh the page and try again"
        } else if (error.message && error.message !== 'Unknown error') {
          errorMessage = error.message
        }
      }

      toast.error(errorMessage)
    } finally {
      setIsAuthenticating(null)
    }
  }

  if (!currentSite) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authenticate Robot Session
          </DialogTitle>
          <DialogDescription>
            Select an authentication session to apply to the active robot instance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
                  onClick={() => handleAuthenticate(session.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">{session.name}</h3>
                          <Badge variant={session.is_valid ? 'default' : 'destructive'}>
                            {session.is_valid ? 'Valid' : 'Invalid'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="font-mono truncate">{session.domain}</span>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="capitalize">{session.auth_type}</span>
                          <span className="text-muted-foreground/60">•</span>
                          <span>Used {session.usage_count} times</span>
                        </div>
                        {session.last_used_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last used: {formatDate(session.last_used_at)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAuthenticate(session.id)
                        }}
                        disabled={isAuthenticating === session.id || !session.is_valid}
                        className="flex-shrink-0"
                      >
                        {isAuthenticating === session.id ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                            Authenticating...
                          </>
                        ) : (
                          'Authenticate'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] w-full">
              <EmptyCard
                icon={<Bot className="h-10 w-10 text-muted-foreground" />}
                title="No authentication sessions"
                description="Authentication sessions will appear here when you save them from an active robot instance."
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

