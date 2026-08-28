"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { Switch } from "@/app/components/ui/switch"
import {
  notificationPreferencesService,
  NotificationCategory,
  UserSiteNotification,
} from "@/app/services/notification-preferences.service"
import { defaultSiteNotificationCategories } from "@/lib/notifications/site-notification-policy"
import { useSite } from "@/app/context/SiteContext"
import { useProfile } from "@/app/hooks/use-profile"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  Bell,
  Mail,
  Phone,
  Shield,
  Users,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "@/app/components/ui/icons"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"

const getTranslatedCategories = (t: any) => [
  {
    id: NotificationCategory.LEAD_MANAGEMENT,
    label: t("profile.notifications.categories.leadManagement"),
    description: t("profile.notifications.categories.leadManagementDesc"),
    Icon: Users,
  },
  {
    id: NotificationCategory.TASKS_REMINDERS,
    label: t("profile.notifications.categories.tasksReminders"),
    description: t("profile.notifications.categories.tasksRemindersDesc"),
    Icon: CheckCircle2,
  },
  {
    id: NotificationCategory.ANALYSIS_INSIGHTS,
    label: t("profile.notifications.categories.analysisInsights"),
    description: t("profile.notifications.categories.analysisInsightsDesc"),
    Icon: TrendingUp,
  },
  {
    id: NotificationCategory.HUMAN_INTERVENTION,
    label: t("profile.notifications.categories.humanIntervention"),
    description: t("profile.notifications.categories.humanInterventionDesc"),
    Icon: Bell,
  },
  {
    id: NotificationCategory.SYSTEM_ALERTS,
    label: t("profile.notifications.categories.systemAlerts"),
    description: t("profile.notifications.categories.systemAlertsDesc"),
    Icon: Shield,
  },
] as const

function emptyPreferences(): Partial<UserSiteNotification> {
  return {
    email_enabled: true,
    push_enabled: true,
    categories: defaultSiteNotificationCategories(),
  }
}

function SiteNotificationCard({ site }: { site: { id: string; name: string } }) {
  const { t } = useLocalization()
  const [isExpanded, setIsExpanded] = useState(false)
  const [preferences, setPreferences] = useState<Partial<UserSiteNotification> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!isExpanded) return
    
    let cancelled = false

    async function fetchPreferences() {
      if (preferences) return // already loaded
      
      setIsLoading(true)
      try {
        const data = await notificationPreferencesService.getPreferences(site.id)
        if (cancelled) return
        setPreferences(
          data
            ? {
                ...data,
                categories: {
                  ...defaultSiteNotificationCategories(),
                  ...data.categories,
                },
              }
            : emptyPreferences()
        )
      } catch (err) {
        console.error("Error fetching preferences:", err)
        toast.error("Failed to load notification preferences")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchPreferences()
    return () => {
      cancelled = true
    }
  }, [isExpanded, site.id, preferences])

  const handleUpdateGlobal = async (key: "email_enabled" | "push_enabled", checked: boolean) => {
    if (!preferences) return

    const previous = preferences
    setPreferences({ ...preferences, [key]: checked })
    setIsUpdating(true)

    try {
      await notificationPreferencesService.updatePreferences(site.id, { [key]: checked })
      toast.success("Preferences updated")
    } catch (err) {
      setPreferences(previous)
      toast.error("Failed to update preferences")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateCategory = async (category: string, checked: boolean) => {
    if (!preferences) return

    const previous = preferences
    const newCategories = { ...(preferences.categories || {}), [category]: checked }
    setPreferences({ ...preferences, categories: newCategories })
    setIsUpdating(true)

    try {
      await notificationPreferencesService.updatePreferences(site.id, {
        categories: newCategories,
      })
      toast.success("Preferences updated")
    } catch (err) {
      setPreferences(previous)
      toast.error("Failed to update category")
    } finally {
      setIsUpdating(false)
    }
  }

  const isGlobalDisabled =
    !(preferences?.email_enabled ?? true) && !(preferences?.push_enabled ?? true)

  return (
    <SectionCard className="border border-border shadow-sm overflow-hidden mb-6">
      <SectionCardHeader
        className="p-4 bg-background flex flex-row items-center gap-4 space-y-0 cursor-pointer hover:bg-muted/40"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex-1 max-w-[300px]">
          <h3 className="font-semibold text-base">{site.name}</h3>
        </div>
        <div className="flex-1" />
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
      </SectionCardHeader>
      
      {isExpanded && (
        <>
          <SectionCardContent className="space-y-8 p-8 border-t border-border">
            {isLoading ? (
              <div className="flex flex-col space-y-4">
                <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <hr className="border-border my-2" />
                <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 w-full bg-muted rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ) : preferences ? (
              <>
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("profile.notifications.globalSwitch.title")}
                  </h3>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium">{t("profile.notifications.siteEmail.label")}</label>
                        <p className="text-xs text-muted-foreground">
                          {t("profile.notifications.siteEmail.description").replace("{{siteName}}", site.name)}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferences.email_enabled ?? true}
                      onCheckedChange={(checked) => handleUpdateGlobal("email_enabled", checked)}
                      disabled={isUpdating}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-sm font-medium">{t("profile.notifications.sitePush.label")}</label>
                        <p className="text-xs text-muted-foreground">
                          {t("profile.notifications.sitePush.description").replace("{{siteName}}", site.name)}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferences.push_enabled ?? true}
                      onCheckedChange={(checked) => handleUpdateGlobal("push_enabled", checked)}
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                <hr className="border-border" />

                <div className="space-y-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("profile.notifications.categories.title")}
                  </h3>

                  <div className="space-y-6">
                    {getTranslatedCategories(t).map((category) => {
                      const isChecked = preferences.categories?.[category.id] !== false
                      const Icon = category.Icon

                      return (
                        <div key={category.id} className="flex items-center justify-between">
                          <div className="flex gap-3">
                            <div className="mt-0.5">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                              <label className={`text-sm font-medium ${isGlobalDisabled ? "opacity-50" : ""}`}>
                                {category.label}
                              </label>
                              <p className={`text-xs text-muted-foreground ${isGlobalDisabled ? "opacity-50" : ""}`}>
                                {category.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={isChecked}
                            onCheckedChange={(checked) => handleUpdateCategory(category.id, checked)}
                            disabled={isUpdating || isGlobalDisabled}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </SectionCardContent>
          {preferences && !isLoading && (
            <ActionFooter>
              <div className="flex items-center justify-end w-full">
                <Button 
                  variant="outline"
                  type="button"
                  disabled={true}
                  className="rounded-full px-6 border-foreground/20 font-medium" 
                  size="sm"
                >
                  {isUpdating ? "Saving..." : "Saved"}
                </Button>
              </div>
            </ActionFooter>
          )}
        </>
      )}
    </SectionCard>
  )
}

export function SiteNotificationsPreferences() {
  const { t } = useLocalization()
  const { sites } = useSite()
  const { notifications, updateNotifications, isUpdating: isProfileUpdating } = useProfile()

  if (sites.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t("profile.notifications.noSites.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("profile.notifications.noSites.description")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleGlobalChange = async (key: "email" | "push", checked: boolean) => {
    await updateNotifications({
      ...notifications,
      [key]: checked
    })
  }

  const disabledChannels = []
  if (!notifications.email) disabledChannels.push("email")
  if (!notifications.push) disabledChannels.push("push")
  
  const hasAnyMasterSwitchDisabled = disabledChannels.length > 0
  const hasAllMasterSwitchesDisabled = disabledChannels.length === 2

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t("profile.notifications.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("profile.notifications.description")}
          </p>
        </div>
      </div>
      
      <SectionCard className="border border-border shadow-sm overflow-hidden mb-8">
        <SectionCardHeader className="p-6 bg-background">
          <SectionCardTitle>{t("profile.notifications.globalSwitch.title")}</SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("profile.notifications.globalSwitch.description")}
          </p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-6 p-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="mt-0.5">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <label className="text-sm font-medium">{t("profile.notifications.globalEmail.label")}</label>
                <p className="text-xs text-muted-foreground">
                  {t("profile.notifications.globalEmail.description")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) => handleGlobalChange("email", checked)}
              disabled={isProfileUpdating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="mt-0.5">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <label className="text-sm font-medium">{t("profile.notifications.globalPush.label")}</label>
                <p className="text-xs text-muted-foreground">
                  {t("profile.notifications.globalPush.description")}
                </p>
              </div>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) => handleGlobalChange("push", checked)}
              disabled={isProfileUpdating}
            />
          </div>
        </SectionCardContent>
        <ActionFooter>
          <div className="flex items-center justify-end w-full">
            <Button 
              variant="outline"
              type="button"
              disabled={true}
              className="rounded-full px-6 border-foreground/20 font-medium" 
              size="sm"
            >
              {isProfileUpdating ? t("profile.notifications.saving") : t("profile.notifications.saved")}
            </Button>
          </div>
        </ActionFooter>
      </SectionCard>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">{t("profile.notifications.perSite.title")}</h3>
        {hasAnyMasterSwitchDisabled && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-900/50">
            {t("profile.notifications.overrideWarning", { channels: disabledChannels.join(" and ") })}
          </p>
        )}
        <div className={hasAllMasterSwitchesDisabled ? "opacity-75 transition-opacity" : "transition-opacity"}>
          {sites.map((site) => (
            <SiteNotificationCard key={site.id} site={site} />
          ))}
        </div>
      </div>
    </div>
  )
}
