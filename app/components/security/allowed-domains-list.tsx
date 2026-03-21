import { useState, useEffect } from "react"
import { useAllowedDomains } from "@/app/hooks/use-allowed-domains"
import { useSite } from "@/app/context/SiteContext"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Button } from "@/app/components/ui/button"
import { AddDomainDialog } from "@/app/components/domains/add-domain-dialog"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Globe, Trash2 } from "@/app/components/ui/icons"
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

export function AllowedDomainsList() {
  const { domains, isLoading, isSubmitting, addDomain, deleteDomain } = useAllowedDomains()
  const { currentSite } = useSite()

  // Emit domains update event whenever list changes
  useEffect(() => {
    if (domains.length > 0) {
      const domainsData = domains.map((domain, index) => ({
        id: `allowed-domain-${index}`,
        title: domain.domain || `Domain ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('allowedDomainsUpdated', { 
        detail: domainsData 
      }));
    }
  }, [domains]);

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <EmptyCard
          icon={<Globe className="h-10 w-10 text-muted-foreground" />}
          title="Select a site"
          description="Please select a site to manage allowed domains"
        />
      </div>
    )
  }

  return (
    <div id="allowed-domains" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Allowed Domains</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which domains are allowed to make requests to your API
          </p>
        </div>
        <AddDomainDialog onAddDomain={addDomain} />
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
          {/* Domain Cards */}
          {domains.map((domain, index) => (
            <Card key={domain.id} id={`allowed-domain-${index}`} className="border border-border">
              <CardHeader className="px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg font-semibold">{domain.domain}</CardTitle>
                  </div>
                </div>
              </CardHeader>

              {/* Card Footer with individual buttons */}
              <ActionFooter>
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting || domain.domain === 'localhost'}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Domain
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Domain</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove the domain "{domain.domain}"? This action cannot be undone and API requests from this domain will no longer be allowed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDomain(domain.id)}
                          className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                        >
                          Remove Domain
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </ActionFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}