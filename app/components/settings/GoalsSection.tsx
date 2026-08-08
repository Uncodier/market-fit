"use client"

import { useFormContext } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Textarea } from "../ui/textarea"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

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
  const [savingCard, setSavingCard] = useState<string | null>(null)

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving goals:", error)
    } finally {
      setSavingCard(null)
    }
  }

  if (!active) return null

  return (
    <div className="space-y-8">
      {GOAL_CARDS.map((card) => (
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
