"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
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
import { CreateQuotationDetailsFields } from "./CreateQuotationDetailsFields"
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
  notes?: string | null
  items?: Array<{ id: string; catalog_item_id: string; name: string; quantity: number; unit_price: number }>
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
    { key: newLineKey(), value: null, quantity: 1 },
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
      notes: "",
    },
  })

  const leadValue = watch("lead_value")
  const isCreateLead = isPendingCreate(leadValue)

  const { data: leadsData } = useSWR(
    open && currentSite ? ["leads", currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData } = useSWR(
    open && currentSite ? ["catalog", currentSite.id] : null,
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
    return lineItems.flatMap((row) => {
      if (!row.value || row.value.mode !== "existing" || row.key.startsWith("existing_")) return []
      const item = catalogItems.find((i) => i.id === row.value!.id)
      if (!item || !hasDynamicQuoteFields(item)) return []
      return [{ lineKey: row.key, item }]
    })
  }, [lineItems, catalogItems])

  const totalSteps = 1 + dynamicSteps.length
  const isDetailsStep = stepIndex === 0
  const activeDynamicStep =
    !isDetailsStep && dynamicSteps.length > 0
      ? dynamicSteps[stepIndex - 1] || null
      : null

  const resetDialog = () => {
    reset()
    setBuyerUser(null)
    setLineItems([{ key: newLineKey(), value: null, quantity: 1 }])
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
      notes: quotationToEdit.notes || "",
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
    if (quotationToEdit.items && quotationToEdit.items.length > 0) {
      setLineItems(
        quotationToEdit.items.map((item) => ({
          key: `existing_${item.id}`,
          value: { mode: "existing", id: item.catalog_item_id, label: item.name },
          quantity: item.quantity,
          unitPrice: item.unit_price,
        }))
      )
    } else {
      setLineItems([{ key: newLineKey(), value: null, quantity: 1 }])
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
        lineItems,
        catalogItems,
        fieldDrafts,
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
    if (dynamicSteps.length > 0) {
      setStepError(null)
      setStepIndex(1)
      return
    }
    if (isEditing) {
      await updateQuotation(data)
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

    if (isEditing) {
      await updateQuotation(getValues())
    } else {
      await createQuotation(getValues())
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetDialog()
  }

  const updateLineValue = (key: string, value: RelationSelectValue) => {
    setLineItems((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)))
  }

  const updateLineQuantity = (key: string, quantity: number) => {
    setLineItems((prev) => prev.map((r) => (r.key === key ? { ...r, quantity } : r)))
  }

  const updateLinePrice = (key: string, unitPrice?: number) => {
    setLineItems((prev) => prev.map((r) => (r.key === key ? { ...r, unitPrice } : r)))
  }

  const removeLine = (key: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return [{ key: newLineKey(), value: null, quantity: 1 }]
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

  const activeConfig = activeDynamicStep
    ? getDynamicPricingConfig(activeDynamicStep.item)
    : null
  const quoteStepValid = activeConfig
    ? !validateDynamicQuoteFields(
        activeConfig,
        fieldDrafts[activeDynamicStep?.lineKey ?? ""]?.values || {},
        t
      )
    : true

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isDetailsStep) {
      e.preventDefault()
      void handleFieldStepNext()
      return
    }
    void goToFieldStepsOrSubmit(e)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent size="lg" className="max-w-3xl" busy={isSubmitting}>
        <DialogForm onSubmit={onFormSubmit}>
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
            {totalSteps > 1 && (
              <div className="flex items-center gap-2 pt-1">
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
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {isDetailsStep ? (
              <CreateQuotationDetailsFields
                register={register}
                errors={errors}
                setValue={setValue}
                buyerUser={buyerUser}
                setBuyerUser={setBuyerUser}
                isSubmitting={isSubmitting}
                isEditing={isEditing}
                isCreateLead={isCreateLead}
                leadValue={leadValue}
                leadOptions={leadOptions}
                lineItems={lineItems}
                catalogOptions={catalogOptions}
                dynamicStepsCount={dynamicSteps.length}
                onAddLine={() =>
                  setLineItems((prev) => [...prev, { key: newLineKey(), value: null, quantity: 1 }])
                }
                onUpdateLine={updateLineValue}
                onUpdateLineQuantity={updateLineQuantity}
                onUpdateLinePrice={updateLinePrice}
                onRemoveLine={removeLine}
              />
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
              />
            ) : null}
          </DialogBody>
          <DialogFooter>
            {isDetailsStep ? (
              <>
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
              </>
            ) : (
              <>
                {!quoteStepValid && !isSubmitting && (
                  <p className="text-sm text-amber-600 sm:mr-auto self-center font-medium">
                    {t("pdp.dynamicQuote.fillFormToQuote") || "Fill the form to get your quote."}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => {
                    setStepError(null)
                    setStepIndex((s) => Math.max(0, s - 1))
                  }}
                >
                  {t("common.back") || "Back"}
                </Button>
                <Button type="submit" disabled={isSubmitting || !quoteStepValid}>
                  {isSubmitting
                    ? t("quotations.create.creating") || "Creating..."
                    : stepIndex >= totalSteps - 1
                      ? t("quotations.create.submit") || "Create Quotation"
                      : t("common.next") || "Next"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
