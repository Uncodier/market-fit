import type { CatalogItem } from "@/app/types"
import type { ReservationSlotOption } from "@/app/components/commerce/reservation-slot-utils"
import { demoAccountLibrary } from "./demo-commerce"

const sampleDownload = "data:text/plain;charset=utf-8," + encodeURIComponent(
  "Acme Workplace — fictional brand resource sample.\nDemo preview only. No purchased file or private storage is accessed.\n"
)
const catalogDefaults = {
  track_inventory: false, availability_mode: "always", availability_status: "available",
  status: "active", sort_order: 0, is_pos_available: false, is_recurring: false, is_reservation: false,
  created_at: "2026-10-20T10:00:00Z", updated_at: "2026-10-20T10:00:00Z",
} as const

export function getDemoLibraryData(id: string) {
  const row = demoAccountLibrary.find(entry => entry.id === id)
  if (!row) return null
  const subtype = row.catalog_item.digital_subtype as "ticket" | "pass" | "file" | "course"
  const item: CatalogItem & { _shop: { site_name: string } } = {
    ...catalogDefaults,
    ...row.catalog_item,
    digital_subtype: subtype,
    site_id: row.site.id,
    kind: "digital_asset",
    _shop: { site_name: row.site.name },
    ...(subtype === "ticket" ? {
      description: "A gathering for product teams, creators, and community members.",
      metadata: { attributes: { event_date: "November 20, 2030", duration: "1 day" },
        specs: [{ label: "Event time", value: "10:00 AM" }] },
    } : {}),
  }
  const entitlement = {
    ...row,
    catalog_item: item,
    catalog_item_id: item.id,
    site_id: row.site.id,
    metadata: subtype === "ticket" ? { ticket_token: `DEMO-ONLY-NOT-VALID-${id}` }
      : subtype === "course" ? { course_progress: { lastIndex: 0, completedIndexes: [] } } : {},
  }
  const services: CatalogItem[] = [{
    ...catalogDefaults,
    id: `demo-studio-service-${id}`, site_id: row.site.id, name: "Studio workspace session",
    description: "Reserve a quiet workspace for a focused day.",
    image_url: item.image_url, currency: "USD", kind: "service", is_reservation: true,
    metadata: { attributes: { duration: "2 hours" } },
  }]
  return {
    subtype, item, entitlement,
    extras: {
      services,
      files: [
        { id: `${id}-guidelines`, file_name: "Brand guidelines — demo sample.txt", downloadUrl: sampleDownload },
        { id: `${id}-resources`, file_name: "Design resources — demo sample.txt", downloadUrl: sampleDownload },
      ],
    },
  }
}

export function demoLibrarySlots(): ReservationSlotOption[] {
  const slots: ReservationSlotOption[] = []
  for (let offset = 1; offset <= 90; offset++) {
    for (const hour of [10, 14]) {
      const start = new Date()
      start.setDate(start.getDate() + offset)
      start.setHours(hour, 0, 0, 0)
      slots.push({ start: start.toISOString(), end: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        available: 6, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    }
  }
  return slots
}