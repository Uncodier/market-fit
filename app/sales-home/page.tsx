"use client"

import { useAuth } from "@/app/hooks/use-auth"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { PlusCircle, ArrowRight, Users, Briefcase, Rocket, DollarSign, MessageCircle, Search } from "@/app/components/ui/icons"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function SalesHomePage() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const router = useRouter()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  // Update breadcrumbs and title
  useEffect(() => {
    document.title = "Sales Home | Market Fit"
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: "Sales Home",
        path: "/sales-home",
        section: "Sales"
      }
    })
    window.dispatchEvent(event)
    
    return () => {
      document.title = "Market Fit"
    }
  }, [])

  // Navigation items
  const navItems = [
    {
      title: t('layout.sidebar.controlCenter') || "Control Center",
      description: "Manage your tasks and workflows",
      icon: Rocket,
      href: "/control-center"
    },
    {
      title: t('layout.sidebar.sales') || "Sales",
      description: "Track revenue and completed sales",
      icon: DollarSign,
      href: "/sales"
    },
    {
      title: t('layout.sidebar.leads') || "Leads",
      description: "Manage potential customers and prospects",
      icon: Users,
      href: "/leads"
    },
    {
      title: t('layout.sidebar.deals') || "Deals",
      description: "Track opportunities through your pipeline",
      icon: Briefcase,
      href: "/deals"
    },
    {
      title: t('layout.sidebar.chat') || "Chat",
      description: "Communicate with leads and customers",
      icon: MessageCircle,
      href: "/chat"
    },
    {
      title: t('layout.sidebar.people') || "People",
      description: "Manage team members and roles",
      icon: Search,
      href: "/people"
    }
  ]

  // Action handlers
  const handleRegisterSale = () => {
    router.push('/sales')
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('sales:create'))
    }, 500)
  }

  const handleGoToDeals = () => {
    router.push('/deals')
  }

  const handleGoToLeads = () => {
    router.push('/leads')
  }

  return (
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      <div className="p-8 space-y-8 bg-muted/30 flex-1">
        {/* Welcome Section */}
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">
            Hi {userName}, Welcome to Sales 👋
          </h2>
          <p className="text-muted-foreground text-lg">
            Manage your sales pipeline, track deals, and communicate with leads all in one place.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={handleRegisterSale}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center">
                <PlusCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Register Sale</h3>
                <p className="text-sm text-muted-foreground">Record a new completed transaction</p>
              </div>
              <Button variant="secondary" className="w-full mt-2">
                Create Sale
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={handleGoToLeads}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Manage Leads</h3>
                <p className="text-sm text-muted-foreground">View and update your prospects</p>
              </div>
              <Button variant="secondary" className="w-full mt-2">
                View Leads
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={handleGoToDeals}>
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Track Deals</h3>
                <p className="text-sm text-muted-foreground">Monitor your active sales pipeline</p>
              </div>
              <Button variant="secondary" className="w-full mt-2">
                Open Deals
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Grid */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-semibold">Quick Navigation</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {navItems.map((item) => (
              <Card 
                key={item.title} 
                className="hover:shadow-md transition-all cursor-pointer group"
                onClick={() => router.push(item.href)}
              >
                <CardContent className="p-6 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-lg border border-gray-300/50 bg-gray-100/50 dark:border-gray-700/50 dark:bg-gray-800/30 flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
                    {(() => {
                      const Icon = item.icon
                      return <Icon className="text-foreground" size={24} />
                    })()}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold group-hover:text-primary transition-colors flex items-center">
                      {item.title}
                      <ArrowRight className="h-4 w-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
