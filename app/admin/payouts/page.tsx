import React from "react"
import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isPayoutResolverRole } from "@/lib/auth/platform-access"
import { PayoutAdminClient } from "./components/PayoutAdminClient"
import { PayoutsTitle } from "./PayoutsTitle"

export const dynamic = 'force-dynamic'

export default async function AdminPayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: platformRole, error: roleError } = await supabase.rpc(
    'current_user_platform_role'
  )
  if (roleError || !isPayoutResolverRole(platformRole)) {
    redirect('/')
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
        <PayoutsTitle />
      </div>
      
      <PayoutAdminClient initialPayouts={payouts || []} />
    </div>
  )
}
