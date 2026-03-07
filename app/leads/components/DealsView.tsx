import React, { useState, useEffect } from "react"
import { Card } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Target } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { DealsTable } from "@/app/deals/components/DealsTable"

interface DealsViewProps {
  leadId: string
}

export function DealsView({ leadId }: DealsViewProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const { currentSite } = useSite()
  const router = useRouter()

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Load deals
  useEffect(() => {
    const loadDeals = async () => {
      if (!currentSite?.id || !leadId) return

      setLoading(true)
      try {
        const supabase = createClient()
        
        // We get the deals from deal_leads join table
        const { data, error } = await supabase
          .from('deal_leads')
          .select(`
            deal_id,
            deals (
              *,
              companies (name)
            )
          `)
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
        
        if (error) {
          throw error
        }

        if (!data || data.length === 0) {
          setDeals([])
        } else {
          // Format data
          const formattedDeals = data
            .filter((item: any) => item.deals) // Ensure the deal exists
            .map((item: any) => item.deals as Deal)
            
          setDeals(formattedDeals)
        }
        
        setLoading(false)
      } catch (error) {
        console.error("Error loading deals:", error)
        toast.error("Failed to load deals")
        setDeals([])
        setLoading(false)
      }
    }

    loadDeals()
  }, [leadId, currentSite?.id])

  const handleDealClick = (deal: Deal) => {
    router.push(`/deals/${deal.id}`)
  }

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentDeals = deals.slice(indexOfFirstItem, indexOfLastItem)

  if (!loading && deals.length === 0) {
    return (
      <EmptyCard
        title="No Deals Found"
        description="This lead isn't associated with any deals yet."
        icon={<Target className="h-12 w-12 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className="w-full">
      {loading ? (
        <Card className="p-4 border-none shadow-none">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      ) : (
        <DealsTable
          deals={currentDeals}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalDeals={deals.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(value) => {
            setItemsPerPage(Number(value))
            setCurrentPage(1)
          }}
          onDealClick={handleDealClick}
        />
      )}
    </div>
  )
}
