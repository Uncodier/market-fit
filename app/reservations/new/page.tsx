"use client"

import { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { listCatalogItems } from "@/app/catalog/actions"
import { getLeads } from "@/app/leads/actions"
import useSWR from "swr"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { useRouter } from "next/navigation"

export default function AdminNewReservationPage() {
  const { currentSite } = useSite()
  const router = useRouter()

  const [selectedItemId, setSelectedItemId] = useState<string>("")

  const { data: catalogData, isLoading: catalogLoading } = useSWR(
    currentSite?.id ? ["catalog", currentSite.id, "reservable"] : null,
    () => listCatalogItems({ siteId: currentSite!.id, isReservation: true, pageSize: 100 })
  )

  const { data: leadsData } = useSWR(
    currentSite?.id ? ["leads", currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const items = catalogData?.data || []
  const leads = leadsData?.leads || []

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id)
    }
  }, [items, selectedItemId])

  if (catalogLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>
  }

  if (!currentSite) {
    return <div className="min-h-[50vh] flex items-center justify-center">Select a site first.</div>
  }

  const selectedItem = items.find((i: any) => i.id === selectedItemId)

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-muted/20">
      {selectedItem ? (
        <BookingExperience
          mode="admin"
          item={selectedItem}
          siteId={currentSite.id}
          backUrl="/reservations"
          leads={leads}
          headerAction={
            items.length > 0 ? (
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-muted-foreground hidden sm:inline-block">Service:</span>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="w-[200px] sm:w-[240px] h-9">
                    <SelectValue placeholder="Choose a reservable service" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null
          }
        />
      ) : (
        <>
          <header className="absolute top-16 left-0 right-0 z-40 bg-background border-b h-16 flex items-center justify-center px-4 md:px-8">
            <div className="w-full max-w-5xl flex items-center justify-between">
              <div className="flex items-center">
                <Button variant="ghost" size="sm" className="rounded-full pr-4 mr-4" onClick={() => router.push("/reservations")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="font-medium">Back</span>
                </Button>
                <h1 className="text-lg font-bold tracking-tight">Create Reservation</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-muted-foreground hidden sm:inline-block">Service:</span>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="w-[200px] sm:w-[240px] h-9">
                    <SelectValue placeholder="Choose a reservable service" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center pt-24">
            <div className="text-center bg-card border rounded-3xl p-8 max-w-md shadow-sm">
              <h2 className="text-xl font-bold mb-2">No Reservable Services</h2>
              <p className="text-muted-foreground mb-6">Create a reservable service in your catalog first.</p>
              <Button onClick={() => router.push("/catalog")}>Go to Catalog</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
