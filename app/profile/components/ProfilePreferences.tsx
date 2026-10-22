"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Globe, Home } from "@/app/components/ui/icons"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { normalizeLocale, useLocalization } from "@/app/context/LocalizationContext"
import type { SupportedLocale } from "@/app/context/LocalizationContext"
import type { ProfileData, ProfileUpdateData } from "@/app/services/profile.service"

interface ProfilePreferencesProps {
  profile: Pick<ProfileData, "language" | "timezone"> | null
  updateProfile: (data: ProfileUpdateData, silent?: boolean) => Promise<boolean | string>
  isUpdating: boolean
}

export function ProfilePreferences({ profile, updateProfile, isUpdating }: ProfilePreferencesProps) {
  const { locale } = useLocalization()
  const language = normalizeLocale(profile?.language) ?? locale
  const timezone = profile?.timezone || "America/Mexico_City"

  return (
    <ProfilePreferencesForm
      key={`${language}:${timezone}`}
      language={language}
      timezone={timezone}
      updateProfile={updateProfile}
      isUpdating={isUpdating}
    />
  )
}

function ProfilePreferencesForm({ language, timezone, updateProfile, isUpdating }: {
  language: SupportedLocale
  timezone: string
} & Pick<ProfilePreferencesProps, "updateProfile" | "isUpdating">) {
  const { t } = useLocalization()
  const [formData, setFormData] = useState({ language, timezone })

  const handleSavePreferences = async () => {
    try {
      const result = await updateProfile(formData, true)
      if (result === true) {
        toast.success(t("account.preferences.saved"))
      } else {
        toast.error(typeof result === "string" ? t("account.profile.failureDetail", { error: result }) : t("account.preferences.failed"))
      }
    } catch (error) {
      console.error(error)
      toast.error(t("account.preferences.error"))
    }
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>{t("account.preferences.title")}</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent className="space-y-8">
        <div>
          <label htmlFor="profile-language" className="block text-sm font-medium mb-2">{t("language")}</label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Select
              value={formData.language}
              onValueChange={(value) => {
                const language = normalizeLocale(value)
                if (language) setFormData(prev => ({ ...prev, language }))
              }}
            >
              <SelectTrigger id="profile-language" className="w-full pl-12 h-12 text-base transition-colors duration-200">
                <SelectValue placeholder={t("account.preferences.languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t("language.es")}</SelectItem>
                <SelectItem value="en">{t("language.en")}</SelectItem>
                <SelectItem value="fr">{t("language.fr")}</SelectItem>
                <SelectItem value="de">{t("language.de")}</SelectItem>
                <SelectItem value="ja">{t("language.ja")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="profile-timezone" className="block text-sm font-medium mb-2">{t("timezone")}</label>
          <div className="relative">
            <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Select
              value={formData.timezone}
              onValueChange={(timezone) => setFormData(prev => ({ ...prev, timezone }))}
            >
              <SelectTrigger id="profile-timezone" className="w-full pl-12 h-12 text-base transition-colors duration-200">
                <SelectValue placeholder={t("account.preferences.timezonePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Mexico_City">{t("account.preferences.mexico")}</SelectItem>
                <SelectItem value="America/Los_Angeles">{t("account.preferences.la")}</SelectItem>
                <SelectItem value="America/New_York">{t("account.preferences.ny")}</SelectItem>
                <SelectItem value="Europe/Madrid">{t("account.preferences.madrid")}</SelectItem>
                <SelectItem value="Europe/London">{t("account.preferences.london")}</SelectItem>
                <SelectItem value="Asia/Tokyo">{t("account.preferences.tokyo")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCardContent>
      <ActionFooter>
        <Button
          variant="outline"
          type="button"
          onClick={handleSavePreferences}
          disabled={isUpdating}
          size="sm"
        >
          {isUpdating ? t("common.saving") : t("account.preferences.save")}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}