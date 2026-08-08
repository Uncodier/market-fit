"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

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
  const [savingCard, setSavingCard] = useState<string | null>(null)

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving SWOT:", error)
    } finally {
      setSavingCard(null)
    }
  }

  if (!active) return null

  return (
    <div className="space-y-8">
      {SWOT_CARDS.map((card) => (
        <Card
          key={card.id}
          id={card.id}
          className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <CardHeader className="px-8 py-6">
            <CardTitle className="text-xl font-semibold">{t(card.titleKey)}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t(card.descriptionKey)}
            </p>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <FormField
              control={form.control}
              name={card.field}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder={t(card.placeholderKey)}
                      className="min-h-[120px]"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
            <Button
              variant="outline"
              onClick={() => handleSave(card.cardId)}
              disabled={savingCard === card.cardId}
            >
              {savingCard === card.cardId
                ? t("settings.company.common.saving")
                : t("settings.company.common.save")}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
