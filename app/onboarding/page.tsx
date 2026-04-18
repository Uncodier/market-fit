"use client"

import { useAuth } from "@/app/hooks/use-auth"
import OnboardingItinerary from "@/app/components/dashboard/onboarding-itinerary"

export default function OnboardingPage() {
  const { user } = useAuth()
  const userName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User"

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <OnboardingItinerary userName={userName} />
    </div>
  )
}
