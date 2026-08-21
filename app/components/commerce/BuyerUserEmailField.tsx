"use client"

import { useState } from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { X, Check } from "@/app/components/ui/icons"
import { resolveBuyerUserByEmail } from "@/app/commerce/resolve-buyer-lead"
import { useLocalization } from "@/app/context/LocalizationContext"

export interface BuyerUser {
  buyerUserId: string
  email: string
  name: string
}

interface BuyerUserEmailFieldProps {
  value: BuyerUser | null
  onChange: (value: BuyerUser | null) => void
  disabled?: boolean
  required?: boolean
  inputClassName?: string
  buttonClassName?: string
}

export function BuyerUserEmailField({
  value,
  onChange,
  disabled,
  required = false,
  inputClassName = "",
  buttonClassName = "",
}: BuyerUserEmailFieldProps) {
  const { t } = useLocalization()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await resolveBuyerUserByEmail(email.trim())
      if (error || !data) {
        toast.error(error || "No platform user found with this email.")
        return
      }

      onChange({
        buyerUserId: data.userId,
        email: data.email,
        name: data.name,
      })
      setEmail("")
    } catch {
      toast.error("Failed to lookup user")
    } finally {
      setIsLoading(false)
    }
  }

  if (value) {
    return (
      <div className="space-y-2">
        <Label>{t("commerce.buyer.linked") || "Buyer account (Linked)"}</Label>
        <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/20">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              {value.email}
            </span>
            {value.name && value.name !== value.email && (
              <span className="text-xs text-muted-foreground pl-6">{value.name}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {required
            ? t("commerce.buyer.hintRequired") || "This user will be able to see this asset in their buyer portal."
            : t("commerce.buyer.hintOptionalDocument") || "This user will be able to see this document in their buyer portal."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>
        {t("commerce.buyer.emailLabel") || "Buyer account (email)"}
        {required ? null : (
          <span className="text-muted-foreground font-normal"> {t("commerce.buyer.optional") || "(Optional)"}</span>
        )}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          placeholder={t("commerce.buyer.emailPlaceholder") || "e.g. user@example.com"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled || isLoading}
          className={`flex-1 ${inputClassName}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSearch()
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleSearch}
          disabled={disabled || isLoading || !email.trim()}
          className={`w-24 shrink-0 flex items-center justify-center ${buttonClassName}`}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            t("commerce.buyer.lookup") || "Lookup"
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("commerce.buyer.hintLink") || "Link an existing platform user so they can access this in their buyer portal."}
      </p>
    </div>
  )
}
