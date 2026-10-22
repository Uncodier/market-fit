"use client"

import { getSelfServiceOptions, type SelfServiceFulfillment } from "@/app/commerce/self-service-options"
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "../ui/form"
import { Switch } from "../ui/switch"
import { Store } from "../ui/icons"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader, SectionCardTitle } from "../ui/section-card"
import type { useShopSection } from "./use-shop-section"

const options: { value: SelfServiceFulfillment; label: string; description: string }[] = [
  { value: "pickup", label: "Pickup", description: "Customers collect their order at this location." },
  { value: "dine_in", label: "Dine in", description: "Customers order for consumption at this location." },
]

export function ShopSelfServiceCard({ form, savingCard, handleSave }: Pick<ReturnType<typeof useShopSection>, "form" | "savingCard" | "handleSave">) {
  const configured = getSelfServiceOptions(form.watch("shop"))
  return (
    <SectionCard id="shop-self-service">
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-muted-foreground" />Self-service ordering
        </SectionCardTitle>
        <p className="text-sm text-muted-foreground">
          Choose fulfillment for location QR ordering. Orders reach the kitchen only after full payment.
          Share each location&apos;s link and QR code in Company settings.
        </p>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        {options.map((option) => (
          <FormField key={option.value} control={form.control} name="shop.self_service_fulfillment_options" render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <FormLabel>{option.label}</FormLabel>
                <FormDescription>{option.description}</FormDescription>
              </div>
              <FormControl>
                <Switch checked={configured.includes(option.value)} onCheckedChange={(checked) => {
                  field.onChange(checked
                    ? options.map(({ value }) => value).filter((value) => value === option.value || configured.includes(value))
                    : configured.filter((value) => value !== option.value))
                }} />
              </FormControl>
            </FormItem>
          )} />
        ))}
        {configured.length === 0 && <p className="text-sm text-muted-foreground">Self-service ordering is disabled until a fulfillment option is enabled.</p>}
      </SectionCardContent>
      <SectionCardFooter dirty={Boolean(form.formState.dirtyFields.shop?.self_service_fulfillment_options)}
        saving={savingCard === "self-service"} onSave={() => handleSave("self-service")} />
    </SectionCard>
  )
}