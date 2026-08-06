"use client"

import { CatalogItem } from "@/app/types"
import { getDynamicPricingConfig } from "@/app/catalog/dynamic-pricing"
import { DynamicQuoteFieldsForm, validateDynamicQuoteFields } from "@/app/components/commerce/DynamicQuoteFieldsForm"
import { Button } from "@/app/components/ui/button"
import { DialogFooter } from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"

export type QuoteFieldDraft = {
  values: Record<string, unknown>
  quantity: number
}

interface CreateQuotationQuoteStepProps {
  item: CatalogItem
  stepNumber: number
  totalFieldSteps: number
  draft: QuoteFieldDraft
  onDraftChange: (draft: QuoteFieldDraft) => void
  error: string | null
  submitting?: boolean
  isLast: boolean
  onBack: () => void
  onNext: () => void
}

export function CreateQuotationQuoteStep({
  item,
  stepNumber,
  totalFieldSteps,
  draft,
  onDraftChange,
  error,
  submitting,
  isLast,
  onBack,
  onNext,
}: CreateQuotationQuoteStepProps) {
  const { t } = useLocalization()
  const config = getDynamicPricingConfig(item)
  const isFormValid = config ? !validateDynamicQuoteFields(config, draft.values, t) : true
  if (!config) return null

  return (
    <div className="space-y-4 py-2 flex flex-col h-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("quotations.create.quoteStep") || "Quote fields"} {stepNumber} /{" "}
          {totalFieldSteps}
        </p>
        <h3 className="text-base font-semibold mt-1">{item.name}</h3>
      </div>

      <DynamicQuoteFieldsForm
        config={config}
        values={draft.values}
        onChange={(values) => onDraftChange({ ...draft, values })}
        quantity={draft.quantity}
        onQuantityChange={(quantity) => onDraftChange({ ...draft, quantity })}
        showQuantity
        showExpirationHint
        disabled={submitting}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2 sm:gap-0 mt-auto">
        {!isFormValid && !submitting && (
          <p className="text-sm text-amber-600 sm:mr-auto self-center font-medium">
            {t("pdp.dynamicQuote.fillFormToQuote") || "Fill the form to get your quote."}
          </p>
        )}
        <Button type="button" variant="outline" disabled={submitting} onClick={onBack}>
          {t("common.back") || "Back"}
        </Button>
        <Button type="button" disabled={submitting || !isFormValid} onClick={onNext}>
          {submitting
            ? t("quotations.create.creating") || "Creating..."
            : isLast
              ? t("quotations.create.submit") || "Create Quotation"
              : t("common.next") || "Next"}
        </Button>
      </DialogFooter>
    </div>
  )
}
