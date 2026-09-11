import React from "react"
import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PayoutAdminClient } from "./components/PayoutAdminClient"

export const dynamic = 'force-dynamic'

export default async function AdminPayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // In a real app, verify user is a super admin. For now, we just require authentication.
  if (!user) {
    redirect('/auth/login')
  }

  const serviceClient = await createServiceClient(true)

  // Fetch all pending payouts with site info
  const { data: payouts } = await serviceClient
    .from('payout_requests')
    .select(`
      *,
      site:sites(name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Platform Payouts</h1>
          <p className="text-muted-foreground mt-2">Manage and resolve pending payout requests from all sites.</p>
        </div>
      </div>
      
      <PayoutAdminClient initialPayouts={payouts || []} />
    </div>
  )
}
