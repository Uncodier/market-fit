import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Key, Trash2, Clock, ChevronDown, ChevronRight, Shield, Globe, Lock, AlertCircle, BarChart } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { ApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys"
import { CreateKeyDialog } from "./create-key-dialog"
import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Card, CardContent } from "@/app/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy')
}

function formatDateTime(date: string) {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

// Component for individual API key row
function ApiKeyRow({
  apiKey,
  isExpanded,
  onToggle,
  onRevoke,
  isSubmitting
}: {
  apiKey: ApiKey;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onRevoke: (id: string) => void;
  isSubmitting: boolean;
}) {
  return (
    <Collapsible
      key={apiKey.id}
      open={isExpanded}
      onOpenChange={() => {}} // Disable automatic toggle
      className="w-full"
    >
      <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
        <div 
          className="flex items-center hover:bg-muted/50 transition-colors w-full cursor-pointer"
          onClick={() => onToggle(apiKey.id)}
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
                    onToggle(apiKey.id);
                  }}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{apiKey.name}</h3>
                <p className="text-sm text-muted-foreground/80 truncate">
                  <span className="font-mono">{apiKey.prefix}***</span> • Created {formatDate(apiKey.created_at)}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
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
              </div>
            </div>
          </CardContent>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-6 px-6 border-t bg-muted/30" onClick={(e) => e.stopPropagation()}>
            <div className="grid gap-6 pt-6">
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

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-[10px]">#</span>
                  <span className="font-mono">{apiKey.id}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRevoke(apiKey.id)}
                  disabled={isSubmitting || apiKey.status !== 'active'}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Revoke Key
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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
      setKeys(apiKeys)
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
    <div className="space-y-4">
      {keys.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            {keys.map((key) => (
              <ApiKeyRow
                key={key.id}
                apiKey={key}
                isExpanded={expandedRows[key.id] || false}
                onToggle={toggleRow}
                onRevoke={handleRevoke}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
          <CreateKeyDialog onSuccess={loadKeys} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
          <EmptyCard
            icon={<Key className="h-10 w-10 text-muted-foreground" />}
            title="No API keys"
            description="Create an API key to start making requests to the API"
          />
          <div className="mt-6 w-full max-w-sm">
            <CreateKeyDialog onSuccess={loadKeys} />
          </div>
        </div>
      )}
    </div>
  )
} 