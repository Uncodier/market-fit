import type { ComponentProps } from "react"
import { PdpItemDescription } from "./PdpItemDescription"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpPriceBlock } from "./PdpPriceBlock"

export function PdpProductSummary({ name, description, price, currency, chips }: {
  name: string
  description: ComponentProps<typeof PdpItemDescription>["description"]
  price: number
  currency: string
  chips: ComponentProps<typeof PdpMetricChips>["chips"]
}) {
  return (
    <div className="mb-8 sm:mb-10">
      <PdpMetricChips className="mb-4 sm:mb-6" chips={chips} />
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">{name}</h1>
      <PdpPriceBlock price={price} currency={currency} />
      <PdpItemDescription description={description} variant="inline" className="mt-4 sm:mt-6" />
    </div>
  )
}