import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Key, Trash2, Clock } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { ApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys"
import { CreateKeyDialog } from "./create-key-dialog"
import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy')
}

function formatDateTime(date: string) {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

export function ApiKeysList() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {keys.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="hidden md:table-header-group">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Rate Limits</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} className="block md:table-row border-b last:border-0 md:border-0">
                      <TableCell className="block md:table-cell py-4 md:py-2">
                        <div className="flex items-center justify-between md:justify-start gap-2">
                          <span className="font-medium">{key.name}</span>
                          <div className="flex items-center gap-2 md:hidden">
                            <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                              {key.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleRevoke(key.id)}
                              disabled={isSubmitting || key.status !== 'active'}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Revoke key</span>
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="block md:table-cell py-2">
                        <div className="grid grid-cols-2 md:block gap-2">
                          <span className="text-sm text-muted-foreground md:hidden">Prefix</span>
                          <span className="font-mono text-sm">{key.prefix}</span>
                        </div>
                      </TableCell>
                      <TableCell className="block md:table-cell py-2">
                        <div className="grid grid-cols-2 md:block gap-2">
                          <span className="text-sm text-muted-foreground md:hidden">Scopes</span>
                          <div className="flex flex-wrap gap-1">
                            {key.scopes.map(scope => (
                              <Badge key={scope} variant="outline">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="block md:table-cell py-2">
                        <div className="grid grid-cols-2 md:block gap-2">
                          <span className="text-sm text-muted-foreground md:hidden">Rate Limits</span>
                          {key.metadata?.rate_limits && (
                            <span className="text-sm text-muted-foreground">
                              {key.metadata.rate_limits.requests_per_minute}/min
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="block md:table-cell py-2">
                        <div className="grid grid-cols-2 md:block gap-2">
                          <span className="text-sm text-muted-foreground md:hidden">Created</span>
                          <span>{formatDate(key.created_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="block md:table-cell py-2">
                        <div className="grid grid-cols-2 md:block gap-2">
                          <span className="text-sm text-muted-foreground md:hidden">Expires</span>
                          <span>{formatDate(key.expires_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="block md:table-cell py-2">
                        <div className="grid grid-cols-2 md:block gap-2">
                          <span className="text-sm text-muted-foreground md:hidden">Last Used</span>
                          {key.last_used_at ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(key.last_used_at)}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevoke(key.id)}
                          disabled={isSubmitting || key.status !== 'active'}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Revoke key</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          <div className="mt-6 w-full">
            <CreateKeyDialog onSuccess={loadKeys} />
          </div>
        </div>
      )}
    </div>
  )
} 