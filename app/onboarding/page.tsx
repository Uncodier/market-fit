"use client"

import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import OnboardingItinerary from "@/app/components/dashboard/onboarding-itinerary"

export default function OnboardingPage() {
  const { user } = useAuth()
  const { currentSite } = useSite()
  const router = useRouter()
  
  const userName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User"

  useEffect(() => {
    if (currentSite?.id.startsWith('demo-')) {
      router.replace('/dashboard')
    }
  }, [currentSite?.id, router])

  if (currentSite?.id.startsWith('demo-')) {
    return null
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <OnboardingItinerary userName={userName} />
    </div>
  )
}
