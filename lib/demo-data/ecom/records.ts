import { isoDaysAgo, makeRecord, makeRecordCategory } from "../factories"

const SITE = "demo-ecom-es-456"

const returnFields = [
  { id: "ret-reason", name: "reason", type: "select", options: ["size", "defect", "changed_mind"] },
  { id: "ret-customer", name: "customer", type: "relation", relationTarget: "lead" },
  { id: "ret-sku", name: "sku", type: "text" },
]

const supplierFields = [
  { id: "sup-vendor", name: "vendor", type: "text" },
  { id: "sup-owner", name: "owner", type: "relation", relationTarget: "team_member" },
  { id: "sup-notes", name: "notes", type: "text" },
]

export const ecomRecords = {
  record_categories: [
    makeRecordCategory("rcat-ecom-returns", SITE, "Returns", returnFields, { icon: "undo" }),
    makeRecordCategory("rcat-ecom-supplier", SITE, "Supplier follow-ups", supplierFields, { icon: "truck" }),
  ],
  records: [
    makeRecord("rec-ecom-1", SITE, "rcat-ecom-returns", "Dress exchange — size M", {
      status: "draft",
      created_at: isoDaysAgo(2),
      data: { reason: "size", sku: "W-DRESS-01" },
      relations: { customer: "lead-ecom-1" },
    }),
    makeRecord("rec-ecom-2", SITE, "rcat-ecom-returns", "Belt stitch defect", {
      status: "published",
      created_at: isoDaysAgo(4),
      data: { reason: "defect", sku: "A-BLT-01" },
      relations: { customer: "lead-ecom-3" },
    }),
    makeRecord("rec-ecom-3", SITE, "rcat-ecom-returns", "Tote changed mind", {
      status: "archived",
      created_at: isoDaysAgo(9),
      updated_at: isoDaysAgo(7),
      data: { reason: "changed_mind", sku: "A-BAG-01" },
      relations: { customer: "lead-ecom-2" },
    }),
    makeRecord("rec-ecom-4", SITE, "rcat-ecom-supplier", "Linen restock from Puebla", {
      status: "draft",
      created_at: isoDaysAgo(1),
      data: { vendor: "Textiles Puebla", notes: "Need 80 more midi dresses" },
      relations: { owner: "demo-user-456" },
    }),
    makeRecord("rec-ecom-5", SITE, "rcat-ecom-supplier", "Denim jacket delay", {
      status: "published",
      created_at: isoDaysAgo(5),
      data: { vendor: "Norte Denim", notes: "ETA slipped one week" },
      relations: { owner: "demo-user-456" },
    }),
    makeRecord("rec-ecom-6", SITE, "rcat-ecom-supplier", "Tote canvas confirmed", {
      status: "archived",
      created_at: isoDaysAgo(14),
      updated_at: isoDaysAgo(12),
      data: { vendor: "Lona MX", notes: "200 units received" },
      relations: { owner: "demo-user-456" },
    }),
  ],
}
