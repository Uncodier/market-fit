import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"
import { getAccountLimit, countConnectedAccounts } from "@/lib/billing-limits"
import { billingLimitApiError } from "@/lib/billing-limit-errors"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> }
) {
  try {
    const supabase = await createSocialSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { sessionToken } = await params
    const body = await request.json().catch(() => ({}))
    const siteId = body.siteId
    
    if (siteId) {
      const { data: site } = await supabase
        .from("sites")
        .select("*, settings!left(*), billing!left(*)")
        .eq("id", siteId)
        .single()
        
      if (site) {
        const parsedSettings = Array.isArray(site.settings) ? site.settings[0] : site.settings
        const parsedBilling = Array.isArray(site.billing) ? site.billing[0] : site.billing
        
        const mappedSite = {
          ...site,
          settings: parsedSettings,
          billing: parsedBilling
        }

        // Enforce account limit
        const limit = getAccountLimit(mappedSite.billing?.plan, mappedSite.billing?.addons_count)
        const currentCount = countConnectedAccounts(mappedSite)
        const newAccountsCount = (body.selectedPageIds || body.accountIds)?.length || 0
        
        if (currentCount + newAccountsCount > limit) {
          return NextResponse.json(
            billingLimitApiError("accounts", currentCount + newAccountsCount, limit),
            { status: 403 }
          )
        }
      }
    }

    const response = await fetch(
      getOutstandIntegrationUrl(`/social-accounts/pending/${sessionToken}/finalize`),
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": process.env.SERVICE_API_KEY || ""
        },
        body: JSON.stringify(body),
      }
    )
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying finalize:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
