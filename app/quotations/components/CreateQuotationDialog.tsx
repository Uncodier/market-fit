"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerUserEmailField, BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { isPendingCreate } from "@/app/commerce/resolve-relation"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { useRouter } from "next/navigation"
import { CatalogItem } from "@/app/types"
import {
  getDynamicPricingConfig,
  hasDynamicQuoteFields,
} from "@/app/catalog/dynamic-pricing"
import { validateDynamicQuoteFields } from "@/app/components/commerce/DynamicQuoteFieldsForm"
import { cn } from "@/lib/utils"
import {
  CreateQuotationQuoteStep,
  QuoteFieldDraft,
} from "./CreateQuotationQuoteStep"
import { CreateQuotationLineItems } from "./CreateQuotationLineItems"
import {
  CreateQuotationFormData,
  CreateQuotationLine,
  submitCreateQuotation,
  submitUpdateQuotation,
} from "./create-quotation-submit"

function newLineKey() {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export type QuotationToEdit = {
  id: string
  status?: string
  title?: string | null
  lead?: { id: string; name?: string | null; email?: string | null; buyer_user_id?: string | null } | null
  deal?: { id: string; name?: string | null; amount?: number | null } | null
  buyer_user_id?: string | null
}

interface CreateQuotationDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  quotationToEdit?: QuotationToEdit | null
  onSuccess?: () => void
}

export function CreateQuotationDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  quotationToEdit = null,
  onSuccess,
}: CreateQuotationDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    controlledOnOpenChange?.(next)
  }

  const isEditing = Boolean(quotationToEdit?.id)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [buyerUser, setBuyerUser] = useState<BuyerUser | null>(null)
  const [lineItems, setLineItems] = useState<CreateQuotationLine[]>([
    { key: newLineKey(), value: null },
  ])
  const [stepIndex, setStepIndex] = useState(0)
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, QuoteFieldDraft>>({})
  const [stepError, setStepError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreateQuotationFormData>({
    defaultValues: {
      name: "",
      lead_value: null,
      clientEmail: "",
      amount: "",
    },
  })

  const leadValue = watch("lead_value")
  const isCreateLead = isPendingCreate(leadValue)

  const { data: leadsData } = useSWR(
    open && currentSite ? ["leads", currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData } = useSWR(
    open && currentSite && !isEditing ? ["catalog", currentSite.id] : null,
    () => listCatalogItems({ siteId: currentSite!.id, pageSize: 100 })
  )

  const catalogItems = (catalogData?.data || []) as CatalogItem[]

  const leadOptions = (leadsData?.leads || leadsData || []).map(
    (l: { id: string; name?: string; email?: string }) => ({
      id: l.id,
      label: l.name || l.email || l.id,
    })
  )

  const catalogOptions = catalogItems.map((i) => ({
    id: i.id,
    label: i.name,
  }))

  const dynamicSteps = useMemo(() => {
    if (isEditing) return []
    return lineItems.flatMap((row) => {
      if (!row.value || row.value.mode !== "existing") return []
      const item = catalogItems.find((i) => i.id === row.value!.id)
      if (!item || !hasDynamicQuoteFields(item)) return []
      return [{ lineKey: row.key, item }]
    })
  }, [lineItems, catalogItems, isEditing])

  const totalSteps = isEditing ? 1 : 1 + dynamicSteps.length
  const isDetailsStep = stepIndex === 0
  const activeDynamicStep =
    !isEditing && !isDetailsStep && dynamicSteps.length > 0
      ? dynamicSteps[stepIndex - 1] || null
      : null

  const resetDialog = () => {
    reset()
    setBuyerUser(null)
    setLineItems([{ key: newLineKey(), value: null }])
    setStepIndex(0)
    setFieldDrafts({})
    setStepError(null)
  }

  useEffect(() => {
    if (!open || !quotationToEdit) return

    const lead = quotationToEdit.lead
    const deal = quotationToEdit.deal
    reset({
      name: deal?.name || quotationToEdit.title || "",
      lead_value: lead
        ? { mode: "existing", id: lead.id, label: lead.name || lead.email || lead.id }
        : null,
      clientEmail: lead?.email || "",
      amount:
        deal?.amount != null && Number(deal.amount) !== 0
          ? String(deal.amount)
          : "",
    })

    if (lead?.buyer_user_id && lead.email) {
      setBuyerUser({
        buyerUserId: lead.buyer_user_id,
        email: lead.email,
        name: lead.name || lead.email,
      })
    } else {
      setBuyerUser(null)
    }
    setStepIndex(0)
    setStepError(null)
  }, [open, quotationToEdit, reset])

  const formMessages = {
    clientNameRequired:
      t("quotations.create.errors.clientNameRequired") || "Client name is required",
    clientEmailRequired:
      t("quotations.create.errors.clientEmailRequired") || "Client email is required",
    errorDeal: t("quotations.create.errorDeal") || "Failed to create associated deal",
    errorQuote: isEditing
      ? t("quotations.edit.error") || "Failed to update quotation"
      : t("quotations.create.errorQuote") || "Failed to create quotation",
  }

  const createQuotation = async (data: CreateQuotationFormData) => {
    if (!currentSite) return
    setIsSubmitting(true)
    try {
      const quotationId = await submitCreateQuotation({
        siteId: currentSite.id,
        data,
        buyerUser,
        lineItems,
        catalogItems,
        fieldDrafts,
        messages: formMessages,
      })
      toast.success(t("quotations.create.success") || "Quotation created successfully")
      resetDialog()
      setOpen(false)
      router.push(`/quotations/${quotationId}`)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : formMessages.errorQuote
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateQuotation = async (data: CreateQuotationFormData) => {
    if (!currentSite || !quotationToEdit) return
    setIsSubmitting(true)
    try {
      await submitUpdateQuotation({
        quotationId: quotationToEdit.id,
        siteId: currentSite.id,
        data,
        buyerUser,
        messages: formMessages,
      })
      toast.success(t("quotations.edit.success") || "Quotation updated successfully")
      resetDialog()
      setOpen(false)
      onSuccess?.()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : formMessages.errorQuote
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const goToFieldStepsOrSubmit = handleSubmit(async (data) => {
    if (isEditing) {
      await updateQuotation(data)
      return
    }
    if (dynamicSteps.length > 0) {
      setStepError(null)
      setStepIndex(1)
      return
    }
    await createQuotation(data)
  })

  const handleFieldStepNext = async () => {
    if (!activeDynamicStep) return
    const config = getDynamicPricingConfig(activeDynamicStep.item)
    if (!config) return

    const draft = fieldDrafts[activeDynamicStep.lineKey] || { values: {}, quantity: 1 }
    const validationError = validateDynamicQuoteFields(config, draft.values, t)
    if (validationError) {
      setStepError(validationError)
      return
    }
    setStepError(null)

    if (stepIndex < totalSteps - 1) {
      setStepIndex((s) => s + 1)
      return
    }

    await createQuotation(getValues())
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetDialog()
  }

  const updateLineValue = (key: string, value: RelationSelectValue) => {
    setLineItems((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)))
  }

  const removeLine = (key: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return [{ key: newLineKey(), value: null }]
      return prev.filter((r) => r.key !== key)
    })
    setFieldDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const submitLabel = isSubmitting
    ? isEditing
      ? t("quotations.edit.saving") || "Saving..."
      : t("quotations.create.creating") || "Creating..."
    : isEditing
      ? t("quotations.edit.submit") || "Save Changes"
      : dynamicSteps.length > 0
        ? t("quotations.create.continue") || "Continue"
        : t("quotations.create.submit") || "Create Quotation"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("quotations.edit.title") || "Edit Quotation"
              : t("quotations.create.title") || "Create New Quotation"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("quotations.edit.desc") ||
                "Update the basic details for this draft quotation."
              : isDetailsStep
                ? t("quotations.create.desc") ||
                  "This will create a new quotation and its associated deal."
                : t("quotations.create.quoteAssistantDesc") ||
                  "Fill quote fields for each dynamic pricing item."}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && totalSteps > 1 && (
          <div className="flex items-center gap-2 pb-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}

        {isDetailsStep ? (
          <form onSubmit={goToFieldStepsOrSubmit} className="space-y-4 py-2">
            <BuyerUserEmailField
              value={buyerUser}
              onChange={setBuyerUser}
              disabled={isSubmitting}
            />

            <div className="space-y-2">
              <Label htmlFor="name">
                {t("quotations.create.fields.name") || "Quotation / Project Name"}
              </Label>
              <Input
                id="name"
                placeholder={
                  t("quotations.create.fields.namePlaceholder") || "e.g. Website Redesign"
                }
                {...register("name", {
                  required:
                    t("quotations.create.errors.nameRequired") || "Name is required",
                })}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("quotations.create.fields.clientName") || "Client Name"}</Label>
              <RelationSelect
                options={leadOptions}
                value={leadValue}
                onValueChange={(val) =>
                  setValue("lead_value", val, { shouldValidate: true })
                }
                placeholder={
                  t("quotations.create.fields.clientNamePlaceholder") ||
                  "Select or create client..."
                }
                disabled={!!buyerUser}
                emptyMessage="No clients found"
              />
            </div>

            {!buyerUser && (isCreateLead || !leadValue) && (
              <div className="space-y-2">
                <Label htmlFor="clientEmail">
                  {t("quotations.create.fields.clientEmail") || "Client Email"}
                </Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder={
                    t("quotations.create.fields.clientEmailPlaceholder") ||
                    "e.g. john@example.com"
                  }
                  {...register("clientEmail", {
                    required:
                      isCreateLead && !buyerUser
                        ? t("quotations.create.errors.clientEmailRequired") ||
                          "Client email is required"
                        : false,
                  })}
                  disabled={!!buyerUser}
                />
                {errors.clientEmail && (
                  <p className="text-xs text-red-500">{errors.clientEmail.message}</p>
                )}
              </div>
            )}

            {!isEditing && (
              <CreateQuotationLineItems
                lineItems={lineItems}
                catalogOptions={catalogOptions}
                dynamicStepsCount={dynamicSteps.length}
                onAdd={() =>
                  setLineItems((prev) => [...prev, { key: newLineKey(), value: null }])
                }
                onUpdate={updateLineValue}
                onRemove={removeLine}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">
                {t("quotations.create.fields.amount") || "Estimated Amount (Optional)"}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        ) : activeDynamicStep ? (
          <CreateQuotationQuoteStep
            item={activeDynamicStep.item}
            stepNumber={stepIndex}
            totalFieldSteps={dynamicSteps.length}
            draft={
              fieldDrafts[activeDynamicStep.lineKey] || { values: {}, quantity: 1 }
            }
            onDraftChange={(draft) =>
              setFieldDrafts((prev) => ({
                ...prev,
                [activeDynamicStep.lineKey]: draft,
              }))
            }
            error={stepError}
            submitting={isSubmitting}
            isLast={stepIndex >= totalSteps - 1}
            onBack={() => {
              setStepError(null)
              setStepIndex((s) => Math.max(0, s - 1))
            }}
            onNext={handleFieldStepNext}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
