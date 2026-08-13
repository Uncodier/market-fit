"use client"

import type { UseFormReturn } from "react-hook-form"
import type * as z from "zod"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Switch } from "@/app/components/ui/switch"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { cn } from "@/lib/utils"
import { campaignFormSchema } from "@/app/campaigns/schema"

export const CAMPAIGN_TYPES = [
  { value: "inbound", label: "Inbound Marketing" },
  { value: "outbound", label: "Outbound Marketing" },
  { value: "branding", label: "Branding" },
  { value: "product", label: "Product Marketing" },
  { value: "events", label: "Events" },
  { value: "success", label: "Customer Success" },
  { value: "account", label: "Account-Based Marketing" },
  { value: "community", label: "Community Marketing" },
  { value: "guerrilla", label: "Guerrilla Marketing" },
  { value: "affiliate", label: "Affiliate Marketing" },
  { value: "experiential", label: "Experiential Marketing" },
  { value: "programmatic", label: "Programmatic Advertising" },
  { value: "performance", label: "Performance Marketing" },
  { value: "publicRelations", label: "Public Relations" },
]

type CampaignForm = z.infer<typeof campaignFormSchema>

export function CreateCampaignFields({
  form,
  segments,
  requirements,
  t,
}: {
  form: UseFormReturn<CampaignForm>
  segments: Array<{ id: string; name: string; description: string }>
  requirements: Array<{ id: string; title: string; description: string }>
  t: (key: string) => string
}) {
  const selectedSegments = form.watch("segments") || []
  const selectedRequirements = form.watch("requirements") || []
  const errors = form.formState.errors

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="title">{t("campaigns.create.titleLabel") || "Title"}</Label>
        <Input
          id="title"
          placeholder={t("campaigns.create.titlePlaceholder") || "Campaign title"}
          {...form.register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">
          {t("campaigns.create.descriptionLabel") || "Description"}
        </Label>
        <Textarea
          id="description"
          placeholder={
            t("campaigns.create.descriptionPlaceholder") ||
            "Describe the campaign objectives and goals"
          }
          className="min-h-[100px]"
          {...form.register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="type">{t("campaigns.create.typeLabel") || "Campaign type"}</Label>
          <Select
            onValueChange={(value) =>
              form.setValue("type", value, { shouldDirty: true })
            }
            defaultValue={form.getValues("type")}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder={t("campaigns.create.selectType") || "Select type"} />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="priority">
            {t("campaigns.create.priorityLabel") || "Priority"}
          </Label>
          <Select
            onValueChange={(value) =>
              form.setValue("priority", value as "high" | "medium" | "low", {
                shouldDirty: true,
              })
            }
            defaultValue={form.getValues("priority")}
          >
            <SelectTrigger id="priority">
              <SelectValue
                placeholder={t("campaigns.create.selectPriority") || "Select priority"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">
                {t("campaigns.create.priorityHigh") || "High"}
              </SelectItem>
              <SelectItem value="medium">
                {t("campaigns.create.priorityMedium") || "Medium"}
              </SelectItem>
              <SelectItem value="low">
                {t("campaigns.create.priorityLow") || "Low"}
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-sm text-destructive">{errors.priority.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dueDate">{t("campaigns.create.dueDateLabel") || "Due date"}</Label>
          <Input id="dueDate" type="date" {...form.register("dueDate")} />
          {errors.dueDate && (
            <p className="text-sm text-destructive">{errors.dueDate.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="budget">{t("campaigns.create.budgetLabel") || "Budget"}</Label>
          <Input
            id="budget"
            type="number"
            placeholder={t("campaigns.create.budgetPlaceholder") || "Budget amount"}
            onChange={(e) => {
              const value = parseFloat(e.target.value)
              if (!isNaN(value)) {
                form.setValue("budget.allocated", value, { shouldDirty: true })
                form.setValue("budget.remaining", value, { shouldDirty: true })
              }
            }}
          />
          {errors.budget?.allocated && (
            <p className="text-sm text-destructive">
              {errors.budget.allocated.message}
            </p>
          )}
        </div>
      </div>

      <ToggleList
        label={t("campaigns.create.targetSegments") || "Target segments"}
        empty={t("campaigns.create.noSegments") || "No segments available"}
        items={segments.map((segment) => ({
          id: segment.id,
          title: segment.name,
          description: segment.description,
          checked: selectedSegments.includes(segment.id),
        }))}
        onToggle={(id, checked) => {
          form.setValue(
            "segments",
            checked
              ? [...selectedSegments, id]
              : selectedSegments.filter((item) => item !== id),
            { shouldDirty: true }
          )
        }}
      />

      <ToggleList
        label={t("campaigns.create.relatedRequirements") || "Related requirements"}
        empty={t("campaigns.create.noRequirements") || "No requirements available"}
        items={requirements.map((requirement) => ({
          id: requirement.id,
          title: requirement.title,
          description: requirement.description,
          checked: selectedRequirements.includes(requirement.id),
        }))}
        onToggle={(id, checked) => {
          form.setValue(
            "requirements",
            checked
              ? [...selectedRequirements, id]
              : selectedRequirements.filter((item) => item !== id),
            { shouldDirty: true }
          )
        }}
      />
    </>
  )
}

function ToggleList({
  label,
  empty,
  items,
  onToggle,
}: {
  label: string
  empty: string
  items: Array<{ id: string; title: string; description: string; checked: boolean }>
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <ScrollArea className="h-[150px] rounded-md border">
        <div className="p-4">
          {items.length > 0 ? (
            items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between space-x-3 rounded-lg border p-4 mb-2 last:mb-0",
                  "transition-colors hover:bg-muted/50",
                  item.checked ? "border-primary/50 bg-primary/5" : ""
                )}
              >
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={`toggle-${item.id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {item.title}
                  </label>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  id={`toggle-${item.id}`}
                  checked={item.checked}
                  onCheckedChange={(checked) => onToggle(item.id, checked)}
                />
              </div>
            ))
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">{empty}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
