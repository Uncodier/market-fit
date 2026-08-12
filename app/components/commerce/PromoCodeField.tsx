"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Tag, Check, Loader2, X } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { previewPromotionForCart } from "@/app/promotions/actions"
import { toast } from "sonner"

const AUTO_VALIDATE_MS = 800

export type PromoCartLine = {
  catalogItemId: string
  subtotal: number
  quantity?: number
}

export type AppliedPromo = {
  code: string
  discount: number
  promotionName?: string
}

interface PromoCodeFieldProps {
  siteId: string
  code: string
  setCode: (val: string) => void
  cartLines: PromoCartLine[]
  buyerUserId?: string | null
  leadId?: string | null
  /** Channel used for promo targeting (marketplace, shop, pos). */
  source?: string | null
  /** POS/pickup location used when source is pos. */
  locationId?: string | null
  applied: AppliedPromo | null
  onApplied: (promo: AppliedPromo) => void
  onCleared: () => void
}

export function PromoCodeField({
  siteId,
  code,
  setCode,
  cartLines,
  buyerUserId,
  leadId,
  source,
  locationId,
  applied,
  onApplied,
  onCleared,
}: PromoCodeFieldProps) {
  const { t } = useLocalization()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cartFingerprint = cartLines
    .map((l) => `${l.catalogItemId}:${l.subtotal}:${l.quantity ?? 1}`)
    .join("|")
  const prevFingerprint = useRef(cartFingerprint)
  const requestIdRef = useRef(0)
  const skipNextAutoRef = useRef(false)

  const validateCode = async (
    rawCode: string,
    options: { silent?: boolean } = {}
  ) => {
    const trimmed = rawCode.trim().toUpperCase()
    if (!trimmed) {
      setError(null)
      onCleared()
      return
    }
    if (!siteId || cartLines.length === 0) return

    // Already in sync with the same code
    if (applied?.code === trimmed && !error) return

    const requestId = ++requestIdRef.current
    setLoading(true)
    if (!options.silent) setError(null)

    try {
      const result = await previewPromotionForCart({
        siteId,
        code: trimmed,
        lines: cartLines,
        buyerUserId,
        leadId,
        source,
        locationId,
      })

      if (requestId !== requestIdRef.current) return

      if ("error" in result && result.error) {
        setError(result.error)
        onCleared()
        if (!options.silent) toast.error(result.error)
        return
      }

      if ("discount" in result) {
        onApplied({
          code: trimmed,
          discount: result.discount,
          promotionName: result.promotionName,
        })
        setCode(trimmed)
        setError(null)
        if (!options.silent) {
          toast.success(t("checkout.promoApplied") || "Promo applied")
        }
      }
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return
      const msg = e?.message || t("checkout.promoInvalid") || "Invalid or inactive promotion code"
      setError(msg)
      onCleared()
      if (!options.silent) toast.error(msg)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (prevFingerprint.current !== cartFingerprint) {
      prevFingerprint.current = cartFingerprint
      if (applied) {
        onCleared()
        setError(null)
      }
    }
  }, [cartFingerprint, applied, onCleared])

  // Debounced auto-validate while typing
  useEffect(() => {
    if (skipNextAutoRef.current) {
      skipNextAutoRef.current = false
      return
    }

    const trimmed = code.trim()
    if (!trimmed) {
      setError(null)
      if (applied) onCleared()
      return
    }

    if (applied?.code === trimmed) return

    const timer = setTimeout(() => {
      void validateCode(trimmed, { silent: true })
    }, AUTO_VALIDATE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validate on code/cart/identity/channel changes only
  }, [code, cartFingerprint, siteId, buyerUserId, leadId, source, locationId])

  const handleCodeChange = (value: string) => {
    const next = value.toUpperCase()
    setCode(next)
    setError(null)
    if (applied && next.trim() !== applied.code) {
      onCleared()
    }
  }

  const handleApply = () => {
    void validateCode(code, { silent: false })
  }

  const handleClear = () => {
    requestIdRef.current += 1
    skipNextAutoRef.current = true
    setCode("")
    setError(null)
    setLoading(false)
    onCleared()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("checkout.promoCode") || "Promo code…"}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleApply()
              }
            }}
            className="uppercase pl-9 h-11 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800"
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {applied ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-3 shrink-0"
            onClick={handleClear}
            aria-label={t("checkout.clearPromo") || "Clear promo"}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl shrink-0 font-medium"
            onClick={handleApply}
            disabled={loading || !code.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("checkout.applyPromo") || "Apply"
            )}
          </Button>
        )}
      </div>

      {applied && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <Check className="h-3.5 w-3.5" />
          <span>
            {t("checkout.promoApplied") || "Promo applied"}
            {applied.promotionName ? `: ${applied.promotionName}` : ""}
          </span>
        </div>
      )}

      {error && !applied && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
