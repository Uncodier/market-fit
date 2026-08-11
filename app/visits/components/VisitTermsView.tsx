"use client"

import { Checkbox } from "@/app/components/ui/checkbox"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"

type Props = {
  termsText: string
  agreed: boolean
  onAgreedChange: (value: boolean) => void
  disabled?: boolean
}

export function VisitTermsView({ termsText, agreed, onAgreedChange, disabled }: Props) {
  const { t } = useLocalization()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">{t("visits.steps.terms.title")}</h3>
        <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {termsText}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="visit-terms-agree"
          checked={agreed}
          disabled={disabled || !termsText}
          onCheckedChange={(v) => onAgreedChange(v === true)}
        />
        <Label htmlFor="visit-terms-agree" className="text-sm font-normal leading-snug cursor-pointer">
          {t("visits.terms.agree")}
        </Label>
      </div>
    </div>
  )
}
