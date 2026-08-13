"use client"

import { useEffect, useState } from "react"
import { CatalogItem } from "@/app/types"
import {
  getDynamicPricingConfig,
  hasDynamicQuoteFields,
} from "@/app/catalog/dynamic-pricing"
import {
  DynamicQuoteFieldsForm,
  validateDynamicQuoteFields,
} from "@/app/components/commerce/DynamicQuoteFieldsForm"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Loader2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

interface DynamicQuoteFieldsModalProps {
  item: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: {
    fieldValues: Record<string, unknown>
    quantity: number
  }) => Promise<void> | void
  confirming?: boolean
}

export function DynamicQuoteFieldsModal({
  item,
  open,
  onOpenChange,
  onConfirm,
  confirming,
}: DynamicQuoteFieldsModalProps) {
  const { t } = useLocalization()
  const config = item ? getDynamicPricingConfig(item) : null
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues({})
      setQuantity(1)
      setError(null)
    }
  }, [open, item?.id])

  if (!item || !config || !hasDynamicQuoteFields(item)) return null

  const validationError = validateDynamicQuoteFields(config, values, t)
  const isFormValid = !validationError

  const handleConfirm = async () => {
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    await onConfirm({ fieldValues: values, quantity })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" busy={confirming}>
        <DialogHeader>
          <DialogTitle>
            {t("quotations.dynamicQuote.requestTitle") || "Quote assistant"} — {item.name}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          {config.requires_advanced_compute && (
            <p className="text-sm text-muted-foreground">
              {t("pdp.dynamicQuote.computeMayTakeMinutes") ||
                "Quotation may take several minutes to compute."}
            </p>
          )}
          {config.requires_authorization && (
            <p className="text-sm text-muted-foreground">
              {t("pdp.dynamicQuote.willBeSentShortly") ||
                "Once ready, it will be sent to you shortly."}
            </p>
          )}
          <DynamicQuoteFieldsForm
            config={config}
            values={values}
            onChange={setValues}
            quantity={quantity}
            onQuantityChange={setQuantity}
            showQuantity
            showExpirationHint
            disabled={confirming}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          {!isFormValid && !confirming && (
            <p className="text-sm text-amber-600 sm:mr-auto self-center font-medium">
              {t("pdp.dynamicQuote.fillFormToQuote") || "Fill the form to get your quote."}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleConfirm} disabled={confirming || !isFormValid}>
            {confirming ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("quotations.dynamicQuote.requesting") || "Requesting..."}
              </span>
            ) : config.requires_advanced_compute ? (
              t("quotations.dynamicQuote.getQuote") || "Get quote"
            ) : (
              t("quotations.dynamicQuote.getInstantAiQuote") || "Get instant AI quote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
