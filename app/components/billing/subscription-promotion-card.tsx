"use client"

import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "../ui/button"
import { CheckCircle, Loader2 } from "../ui/icons"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "../ui/section-card"
import { BillingHelpTooltip } from "./billing-help-tooltip"

interface SubscriptionPromotionCardProps {
  siteId: string
  disabled?: boolean
  onApplied?: () => void | Promise<void>
}

// Remount site-scoped state immediately, including when returning to a previous site.
export function SubscriptionPromotionCard(props: SubscriptionPromotionCardProps) {
  return <SiteSubscriptionPromotionCard key={props.siteId} {...props} />
}

function SiteSubscriptionPromotionCard({ siteId, disabled = false, onApplied }: SubscriptionPromotionCardProps) {
  const { t } = useLocalization()
  const id = useId()
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const request = useRef<AbortController | null>(null)
  const locked = disabled || saving || !siteId.trim()
  const title = t("billing.promotion.title") || "Apply a promotion code"
  const description = t("billing.promotion.description") || "Applies to your subscription and eligible add-ons on the next invoice. Already-issued invoices are unchanged."

  useEffect(() => () => {
    const controller = request.current
    request.current = null
    controller?.abort()
  }, [])

  async function apply() {
    if (locked || request.current) return
    setError("")
    setSuccess("")

    const code = draft.trim()
    if (!code) {
      setError(t("billing.promotion.required") || "Enter a promotion code.")
      return
    }
    if (code.length > 100 || !/^[a-zA-Z0-9]+$/.test(code)) {
      setError(t("billing.promotion.invalid", { maxLength: 100 }) || "Use only letters and numbers, up to 100 characters.")
      return
    }

    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    let alreadyApplied: boolean
    try {
      const response = await fetch("/api/stripe/subscription/promotion", {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, code }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("Promotion request failed")
      const body: unknown = await response.json()
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          !("success" in body) || body.success !== true ||
          !("alreadyApplied" in body) || typeof body.alreadyApplied !== "boolean") {
        throw new Error("Invalid promotion response")
      }
      if (request.current !== controller) return
      alreadyApplied = body.alreadyApplied
    } catch {
      if (request.current === controller) {
        setError(t("billing.promotion.error") || "Could not apply the promotion code. Please check the code and try again.")
      }
      return
    } finally {
      if (request.current === controller) {
        request.current = null
        setSaving(false)
      }
    }

    const message = alreadyApplied
      ? t("billing.promotion.alreadyApplied") || "This promotion code is already applied to your subscription."
      : t("billing.promotion.applied") || "Promotion code applied to your subscription."
    setDraft("")
    setSuccess(message)
    toast.success(message)
    try {
      await onApplied?.()
    } catch {
      // A caller's refresh failure must not misreport a confirmed application.
    }
  }

  return (
    <SectionCard aria-busy={saving}>
      <SectionCardHeader
        title={title}
        actions={
          <BillingHelpTooltip label={`${t("common.help") || "Help"}: ${title}`}>
            {description}
          </BillingHelpTooltip>
        }
      />
      <SectionCardContent>
        <div className="space-y-2">
          <Label htmlFor={id}>{t("billing.promotion.code") || "Promotion code"}</Label>
          <p id={`${id}-description`} className="sr-only">{description}</p>
          <Input
            id={id}
            className="h-10 text-base sm:text-sm"
            value={draft}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={locked}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
            onChange={event => {
              if (locked) return
              setDraft(event.target.value)
              setError("")
              setSuccess("")
            }}
            onKeyDown={event => {
              if (event.key !== "Enter") return
              event.preventDefault()
              event.stopPropagation()
              if (!event.nativeEvent.isComposing) void apply()
            }}
          />
        </div>
        {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
        {success && (
          <p role="status" className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4" aria-hidden={true} />
            {success}
          </p>
        )}
      </SectionCardContent>
      <SectionCardFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={event => {
            event.preventDefault()
            void apply()
          }}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4" aria-hidden={true} />}
          {saving
            ? t("billing.promotion.applying") || "Applying…"
            : t("billing.promotion.apply") || "Apply code"}
        </Button>
      </SectionCardFooter>
    </SectionCard>
  )
}