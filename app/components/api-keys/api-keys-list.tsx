import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Key, Trash2, Clock, ChevronDown, ChevronRight, Shield, Globe, Lock, AlertCircle, BarChart, PlusCircle } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { ApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys"
import { CreateKeyDialog } from "./create-key-dialog"
import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
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

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy')
}

function formatDateTime(date: string) {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

// Component for individual API key card
function ApiKeyCard({
  apiKey,
  index,
  isExpanded,
  onToggle,
  onRevoke,
  isSubmitting
}: {
  apiKey: ApiKey;
  index: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onRevoke: (id: string) => void;
  isSubmitting: boolean;
}) {
  return (
    <Card id={`api-key-${index}`} className="border border-border">
      {/* Collapsible Header */}
      <CardHeader 
        className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => onToggle(apiKey.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">{apiKey.name}</CardTitle>
            <p className="text-sm text-muted-foreground truncate mt-1">
              <span className="font-mono">{apiKey.prefix}***</span> • Created {formatDate(apiKey.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="flex flex-col items-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                {apiKey.status}
              </Badge>
            </div>
            
            <div className="flex flex-col items-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Permissions</p>
              <p className="text-sm font-medium">{apiKey.scopes.length} scope{apiKey.scopes.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Collapsible Content */}
      {isExpanded && (
        <>
        <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t">
          {/* API Key Info */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Keep your API key secure
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This API key provides programmatic access to your site. Do not share it publicly or commit it to version control.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Permissions Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Permissions</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {apiKey.scopes.map(scope => (
                  <Badge key={scope} variant="secondary" className="text-xs">
                    {scope === 'read' && '👁️ '}
                    {scope === 'write' && '✏️ '}
                    {scope === 'delete' && '🗑️ '}
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Rate Limits Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Rate Limits</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Requests per minute</span>
                  <span className="font-mono font-medium">{apiKey.metadata?.rate_limits?.requests_per_minute || '60'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Concurrent requests</span>
                  <span className="font-mono font-medium">{apiKey.metadata?.rate_limits?.concurrent_requests || '5'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* IP Restrictions */}
          {apiKey.metadata?.allowed_ips && apiKey.metadata.allowed_ips.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">IP Restrictions</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {apiKey.metadata.allowed_ips.map((ip, index) => (
                  <div key={index} className="bg-background border rounded-md px-3 py-1.5">
                    <code className="text-xs font-mono">{ip}</code>
                  </div>
                ))}
              </div>
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
                  <span className="text-sm font-medium">{formatDateTime(apiKey.created_at)}</span>
                </div>
              </div>
              {apiKey.last_used_at && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last used</span>
                    <span className="text-sm font-medium">{formatDateTime(apiKey.last_used_at)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="text-sm font-medium">{formatDateTime(apiKey.expires_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key ID */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-[10px]">#</span>
              <span className="font-mono">{apiKey.id}</span>
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
                  disabled={isSubmitting || apiKey.status !== 'active'}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revoke Key
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to revoke this API key "{apiKey.name || apiKey.id}"? This action cannot be undone and all applications using this key will lose access immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onRevoke(apiKey.id)}
                    className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                  >
                    Revoke Key
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </ActionFooter>
        </>
      )}
    </Card>
  )
}

export function ApiKeysList() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const { currentSite } = useSite()

  const loadKeys = async () => {
    if (!currentSite) return
    
    try {
      setIsLoading(true)
      const apiKeys = await listApiKeys(currentSite.id)
      // Sort so newest first (by created_at)
      const sortedKeys = [...apiKeys].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setKeys(sortedKeys)
    } catch (error) {
      console.error("Error loading API keys:", error)
      toast.error("Failed to load API keys")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [currentSite])

  // Emit API keys update event whenever list changes
  useEffect(() => {
    if (keys.length > 0) {
      const keysData = keys.map((key, index) => ({
        id: `api-key-${index}`,
        title: key.name || `API Key ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('apiKeysUpdated', { 
        detail: keysData 
      }));
    }
  }, [keys]);

  const handleRevoke = async (keyId: string) => {
    if (!currentSite) return
    
    try {
      setIsSubmitting(true)
      await revokeApiKey(keyId, currentSite.id)
      toast.success("API key revoked successfully")
      loadKeys()
    } catch (error) {
      console.error("Error revoking API key:", error)
      toast.error("Failed to revoke API key")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRow = (keyId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }))
  }

  const handleCreateSuccess = async () => {
    await loadKeys()
    // Expand the first key (newest) after creation
    setTimeout(() => {
      // Get the updated keys list
      if (currentSite) {
        listApiKeys(currentSite.id).then(apiKeys => {
          const sortedKeys = [...apiKeys].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          if (sortedKeys.length > 0) {
            setExpandedRows(prev => ({
              ...prev,
              [sortedKeys[0]?.id]: true
            }))
          }
        })
      }
    }, 200)
  }

  if (!currentSite) {
    return (
      <EmptyCard
        icon={<Key className="h-10 w-10 text-muted-foreground" />}
        title="Select a site"
        description="Please select a site to manage API keys"
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
    <div id="api-keys" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your API keys to interact with our services programmatically
          </p>
        </div>
        <CreateKeyDialog onSuccess={handleCreateSuccess} />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-muted/40 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* API Key Cards */}
          {keys.map((key, index) => (
            <ApiKeyCard
              key={key.id}
              apiKey={key}
              index={index}
              isExpanded={expandedRows[key.id] || false}
              onToggle={toggleRow}
              onRevoke={handleRevoke}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      )}
    </div>
  )
} 