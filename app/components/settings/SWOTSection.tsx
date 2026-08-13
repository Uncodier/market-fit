"use client"

import { useFormContext } from "react-hook-form"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
  SectionCardFooter,
  isSectionDirty,
} from "@/app/components/ui/section-card"

interface SWOTSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

const SWOT_CARDS = [
  {
    id: "swot-strengths",
    cardId: "strengths",
    field: "swot.strengths" as const,
    titleKey: "settings.company.swot.strengths.title",
    descriptionKey: "settings.company.swot.strengths.description",
    placeholderKey: "settings.company.swot.strengths.placeholder",
  },
  {
    id: "swot-weaknesses",
    cardId: "weaknesses",
    field: "swot.weaknesses" as const,
    titleKey: "settings.company.swot.weaknesses.title",
    descriptionKey: "settings.company.swot.weaknesses.description",
    placeholderKey: "settings.company.swot.weaknesses.placeholder",
  },
  {
    id: "swot-opportunities",
    cardId: "opportunities",
    field: "swot.opportunities" as const,
    titleKey: "settings.company.swot.opportunities.title",
    descriptionKey: "settings.company.swot.opportunities.description",
    placeholderKey: "settings.company.swot.opportunities.placeholder",
  },
  {
    id: "swot-threats",
    cardId: "threats",
    field: "swot.threats" as const,
    titleKey: "settings.company.swot.threats.title",
    descriptionKey: "settings.company.swot.threats.description",
    placeholderKey: "settings.company.swot.threats.placeholder",
  },
] as const

export function SWOTSection({ active, onSave }: SWOTSectionProps) {
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const { dirtyFields } = form.formState
  const [savingCard, setSavingCard] = useState<string | null>(null)

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving SWOT:", error)
    } finally {
      setSavingCard(null)
    }
  }

  if (!active) return null

  return (
    <div className="space-y-4">
      {SWOT_CARDS.map((card) => (
        <SectionCard key={card.id} id={card.id}>
          <SectionCardHeader
            title={t(card.titleKey)}
            description={t(card.descriptionKey)}
          />
          <SectionCardContent>
            <FormField
              control={form.control}
              name={card.field}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder={t(card.placeholderKey)}
                      className="min-h-[72px]"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SectionCardContent>
          <SectionCardFooter
            dirty={isSectionDirty(dirtyFields, card.field)}
            saving={savingCard === card.cardId}
            onSave={() => handleSave(card.cardId)}
            saveLabel={t("settings.company.common.save")}
            savingLabel={t("settings.company.common.saving")}
          />
        </SectionCard>
      ))}
    </div>
  )
}
