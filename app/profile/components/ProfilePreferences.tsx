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
  const [formData, setFormData] = useState({ language, timezone })

  const handleSavePreferences = async () => {
    try {
      const result = await updateProfile(formData, true)
      if (result === true) {
        toast.success("Preferences updated successfully")
      } else {
        toast.error(typeof result === "string" ? `Failed: ${result}` : "Failed to update preferences")
      }
    } catch (error) {
      console.error(error)
      toast.error("Error updating preferences")
    }
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>Preferences</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent className="space-y-8">
        <div>
          <label htmlFor="profile-language" className="block text-sm font-medium mb-2">Language</label>
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
                <SelectValue placeholder="Select your language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="profile-timezone" className="block text-sm font-medium mb-2">Timezone</label>
          <div className="relative">
            <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Select
              value={formData.timezone}
              onValueChange={(timezone) => setFormData(prev => ({ ...prev, timezone }))}
            >
              <SelectTrigger id="profile-timezone" className="w-full pl-12 h-12 text-base transition-colors duration-200">
                <SelectValue placeholder="Select your timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Mexico_City">Mexico City (GMT-6)</SelectItem>
                <SelectItem value="America/Los_Angeles">Los Angeles (GMT-8)</SelectItem>
                <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo (GMT+9)</SelectItem>
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
          {isUpdating ? "Saving..." : "Save Preferences"}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}