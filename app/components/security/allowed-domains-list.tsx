import { Fragment, useEffect, useMemo } from "react"
import { useAllowedDomains } from "@/app/hooks/use-allowed-domains"
import { useSite } from "@/app/context/SiteContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
} from "@/app/components/ui/section-card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { sortAllowedDomainsForDisplay } from "@/lib/security-resource-order"
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
  const sortedDomains = useMemo(() => sortAllowedDomainsForDisplay(domains), [domains])

  // Emit domains update event whenever list changes
  useEffect(() => {
    const domainsData = sortedDomains.map((domain, index) => ({
      id: `allowed-domain-${index}`,
      title: domain.domain || `Domain ${index + 1}`,
    }));

    window.dispatchEvent(new CustomEvent('allowedDomainsUpdated', {
      detail: domainsData
    }));
  }, [sortedDomains]);

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
          <p className="text-sm text-muted-foreground mt-1">
            User-added domains appear first, followed by legacy domains with unknown origin. Harness domains appear below.
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
          {sortedDomains.map((domain, index) => (
            <Fragment key={domain.id}>
            {domain.source === 'harness' && (index === 0 || sortedDomains[index - 1].source !== 'harness') && (
              <h3 className="text-lg font-semibold border-t border-border pt-6">Automatically created domains</h3>
            )}
            <SectionCard id={`allowed-domain-${index}`} className="border border-border">
              <SectionCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <SectionCardTitle className="text-lg font-semibold break-all">{domain.domain}</SectionCardTitle>
                    <Badge variant="secondary">
                      {domain.source === 'harness' ? 'Harness' : domain.source === 'user' ? 'User-added' : 'Unknown origin'}
                    </Badge>
                  </div>
                </div>
              </SectionCardHeader>

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
                          Are you sure you want to remove the domain &quot;{domain.domain}&quot;? This action cannot be undone and API requests from this domain will no longer be allowed.
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
            </SectionCard>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}