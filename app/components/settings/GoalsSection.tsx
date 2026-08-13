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

interface GoalsSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

const GOAL_CARDS = [
  {
    id: "goals-quarterly",
    cardId: "quarterly",
    field: "goals.quarterly" as const,
    titleKey: "settings.company.goals.quarterly.title",
    descriptionKey: "settings.company.goals.quarterly.description",
    placeholderKey: "settings.company.goals.quarterly.placeholder",
  },
  {
    id: "goals-yearly",
    cardId: "yearly",
    field: "goals.yearly" as const,
    titleKey: "settings.company.goals.yearly.title",
    descriptionKey: "settings.company.goals.yearly.description",
    placeholderKey: "settings.company.goals.yearly.placeholder",
  },
  {
    id: "goals-five-year",
    cardId: "fiveYear",
    field: "goals.fiveYear" as const,
    titleKey: "settings.company.goals.fiveYear.title",
    descriptionKey: "settings.company.goals.fiveYear.description",
    placeholderKey: "settings.company.goals.fiveYear.placeholder",
  },
  {
    id: "goals-ten-year",
    cardId: "tenYear",
    field: "goals.tenYear" as const,
    titleKey: "settings.company.goals.tenYear.title",
    descriptionKey: "settings.company.goals.tenYear.description",
    placeholderKey: "settings.company.goals.tenYear.placeholder",
  },
] as const

export function GoalsSection({ active, onSave }: GoalsSectionProps) {
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
      console.error("Error saving goals:", error)
    } finally {
      setSavingCard(null)
    }
  }

  if (!active) return null

  return (
    <div className="space-y-4">
      {GOAL_CARDS.map((card) => (
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
