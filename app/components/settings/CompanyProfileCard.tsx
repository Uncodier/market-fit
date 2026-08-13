"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useState } from "react"
import { COMMON_CURRENCIES } from "@/app/lib/currencies"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
  SectionCardFooter,
  isSectionDirty,
} from "@/app/components/ui/section-card"

interface CompanyProfileCardProps {
  onSave?: (data: SiteFormValues) => void
}

const COMPANY_SIZE_VALUES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"] as const

const INDUSTRY_VALUES = [
  "technology",
  "healthcare",
  "finance",
  "education",
  "retail",
  "manufacturing",
  "entertainment",
  "food",
  "travel",
  "real_estate",
  "professional_services",
  "other",
] as const

const PROFILE_FIELDS = ["about", "company_size", "industry", "currency"]

export function CompanyProfileCard({ onSave }: CompanyProfileCardProps) {
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const { dirtyFields } = form.formState
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving company profile:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard id="company-profile">
      <SectionCardHeader
        title={t("settings.company.profile.title")}
        description={t("settings.company.profile.description")}
      />
      <SectionCardContent>
        <FormField
          control={form.control}
          name="about"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.company.profile.about")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("settings.company.profile.aboutPlaceholder")}
                  className="min-h-[72px]"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>
                {t("settings.company.profile.aboutDescription")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="company_size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.company.profile.companySize")}</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("settings.company.profile.companySizePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMPANY_SIZE_VALUES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {t(`settings.company.size.${size}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.company.profile.industry")}</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("settings.company.profile.industryPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INDUSTRY_VALUES.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {t(`settings.company.industry.${industry}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.company.profile.currency")}</FormLabel>
                <Select
                  value={field.value || "USD"}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("settings.company.profile.currencyPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMMON_CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t("settings.company.profile.currencyDescription")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </SectionCardContent>
      <SectionCardFooter
        dirty={isSectionDirty(dirtyFields, PROFILE_FIELDS)}
        saving={saving}
        onSave={handleSave}
        saveLabel={t("settings.company.common.save")}
        savingLabel={t("settings.company.common.saving")}
      />
    </SectionCard>
  )
}
