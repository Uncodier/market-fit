"use client"

import type { CatalogItem } from "@/app/types"
import { TicketPdpLayout } from "@/app/components/commerce/pdp/TicketPdpLayout"
import { PassPdpLayout } from "@/app/components/commerce/pdp/PassPdpLayout"
import { DigitalPdpLayout } from "@/app/components/commerce/pdp/DigitalPdpLayout"
import { BuyerExperienceShell } from "@/app/components/commerce/pdp/BuyerExperienceShell"
import type { PdpExperience } from "@/app/components/commerce/pdp/pdp-experience"

export function BuyerLibraryExperience({ item, experience, subtype }: {
  item: CatalogItem
  experience: PdpExperience
  subtype: "ticket" | "pass" | "file"
}) {
  const backUrl = experience.backUrl || `/buyer/library?subtype=${subtype}`
  const variant = subtype === "pass" ? "book" : subtype === "file" ? "downloads" : "ticket"
  return (
    <BuyerExperienceShell backUrl={backUrl} variant={variant}>
      {subtype === "ticket" ? <TicketPdpLayout item={item} backUrl={backUrl} experience={experience} />
        : subtype === "pass" ? <PassPdpLayout item={item} backUrl={backUrl} experience={experience} />
          : <DigitalPdpLayout item={item} backUrl={backUrl} experience={experience} />}
    </BuyerExperienceShell>
  )
}