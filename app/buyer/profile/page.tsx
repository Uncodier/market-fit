"use client"

import React from "react"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { LogOut, User, ShoppingCart } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function BuyerProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLocalization()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth?returnTo=/buyer')
  }

  const initial = user?.user_metadata?.first_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'
  const fullName = user?.user_metadata?.first_name 
    ? `${user.user_metadata.first_name} ${user.user_metadata?.last_name || ''}`.trim()
    : t('buyer.profile.myAccount') || 'My Account'
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  // Workspace (profile/projects) lives on app; buyer commerce is proxied under www.
  const workspaceUrl = 'https://app.makinari.com'

  return (
    <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-4 py-8">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-medium text-muted-foreground">
              {initial}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <Link href={`${workspaceUrl}/profile?artifact=true`} className="block">
                <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 text-foreground">
                    <User className="w-5 h-5" />
                    <span className="font-medium">{t('personalInformation') || 'Personal Information'}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{t('view') || 'View'}</span>
                </div>
              </Link>
              <Link href="/marketplace" className="block">
                <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 text-foreground">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-medium">{t('catalog.tabs.marketplace') || 'Marketplace'}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{t('go') || 'Go'}</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Button 
          variant="outline" 
          className="w-full text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
          size="lg"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('signOut') || 'Sign Out'}
        </Button>
      </div>
    </div>
  )
}
