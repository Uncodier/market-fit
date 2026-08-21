"use client"

import { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { BuyerUserEmailField, BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CreateQuotationLineItems } from "./CreateQuotationLineItems"
import { CreateQuotationFormData, CreateQuotationLine } from "./create-quotation-submit"

type CatalogOption = { id: string; label: string }
type LeadOption = { id: string; label: string }

interface CreateQuotationDetailsFieldsProps {
  register: UseFormRegister<CreateQuotationFormData>
  errors: FieldErrors<CreateQuotationFormData>
  setValue: UseFormSetValue<CreateQuotationFormData>
  buyerUser: BuyerUser | null
  setBuyerUser: (user: BuyerUser | null) => void
  isSubmitting: boolean
  isEditing: boolean
  isCreateLead: boolean
  leadValue: RelationSelectValue
  leadOptions: LeadOption[]
  lineItems: CreateQuotationLine[]
  catalogOptions: CatalogOption[]
  dynamicStepsCount: number
  onAddLine: () => void
  onUpdateLine: (key: string, value: RelationSelectValue) => void
  onUpdateLineQuantity: (key: string, quantity: number) => void
  onUpdateLinePrice?: (key: string, price?: number) => void
  onRemoveLine: (key: string) => void
}

export function CreateQuotationDetailsFields({
  register,
  errors,
  setValue,
  buyerUser,
  setBuyerUser,
  isSubmitting,
  isEditing,
  isCreateLead,
  leadValue,
  leadOptions,
  lineItems,
  catalogOptions,
  dynamicStepsCount,
  onAddLine,
  onUpdateLine,
  onUpdateLineQuantity,
  onUpdateLinePrice,
  onRemoveLine,
}: CreateQuotationDetailsFieldsProps) {
  const { t } = useLocalization()

  return (
    <>
      <BuyerUserEmailField
        value={buyerUser}
        onChange={setBuyerUser}
        disabled={isSubmitting}
        inputClassName="h-12"
        buttonClassName="h-12"
      />

      <div className="grid gap-2">
        <Label htmlFor="name">
          {t("quotations.create.fields.name") || "Quotation / Project Name"}
        </Label>
        <Input
          id="name"
          className="h-12"
          placeholder={
            t("quotations.create.fields.namePlaceholder") || "e.g. Website Redesign"
          }
          {...register("name", {
            required: t("quotations.create.errors.nameRequired") || "Name is required",
          })}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-2">
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
          emptyMessage={t("common.noClientsFound") || "No clients found"}
        />
      </div>

      {!buyerUser && (isCreateLead || !leadValue) && (
        <div className="grid gap-2">
          <Label htmlFor="clientEmail">
            {t("quotations.create.fields.clientEmail") || "Client Email"}
          </Label>
          <Input
            id="clientEmail"
            type="email"
            className="h-12"
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

      <CreateQuotationLineItems
        lineItems={lineItems}
        catalogOptions={catalogOptions}
        dynamicStepsCount={dynamicStepsCount}
        onAdd={onAddLine}
        onUpdate={onUpdateLine}
        onUpdateQuantity={onUpdateLineQuantity}
        onUpdatePrice={onUpdateLinePrice}
        onRemove={onRemoveLine}
      />

      <div className="grid gap-2">
        <Label htmlFor="notes">
          {t("quotations.create.fields.notes") || "Terms and Conditions / Notes"}
        </Label>
        <Textarea
          id="notes"
          className="min-h-[80px]"
          placeholder={
            t("quotations.create.fields.notesPlaceholder") || "e.g. Valid for 30 days"
          }
          {...register("notes")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="amount">
          {t("quotations.create.fields.amount") || "Estimated Amount (Optional)"}
        </Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          className="h-12"
          placeholder="0.00"
          {...register("amount")}
        />
      </div>
    </>
  )
}
