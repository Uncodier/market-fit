import { isoDaysAgo, isoNow, makeRecord, makeRecordCategory } from "../factories"

const SITE = "demo-habituall"

const attendanceFields = [
  { id: "att-date", name: "class_date", type: "date" },
  { id: "att-member", name: "member", type: "relation", relationTarget: "lead" },
  { id: "att-notes", name: "notes", type: "text" },
]

const maintenanceFields = [
  { id: "mnt-priority", name: "priority", type: "select", options: ["low", "medium", "high"] },
  { id: "mnt-assignee", name: "assignee", type: "relation", relationTarget: "team_member" },
  { id: "mnt-area", name: "area", type: "text" },
]

export const habituallRecords = {
  record_categories: [
    makeRecordCategory("rcat-hab-attendance", SITE, "Class attendance", attendanceFields, { icon: "clipboard" }),
    makeRecordCategory("rcat-hab-maintenance", SITE, "Maintenance tickets", maintenanceFields, { icon: "wrench" }),
  ],
  records: [
    makeRecord("rec-hab-1", SITE, "rcat-hab-attendance", "Yoga check-in — John Doe", {
      status: "published",
      created_at: isoDaysAgo(3),
      data: { class_date: isoDaysAgo(3).slice(0, 10), notes: "Used 10-class pass" },
      relations: { member: "lead-habituall-1" },
    }),
    makeRecord("rec-hab-2", SITE, "rcat-hab-attendance", "Spin check-in — Jane Smith", {
      status: "published",
      created_at: isoDaysAgo(1),
      data: { class_date: isoDaysAgo(1).slice(0, 10), notes: "First class" },
      relations: { member: "lead-habituall-2" },
    }),
    makeRecord("rec-hab-3", SITE, "rcat-hab-attendance", "Yoga waitlist — Emily Davis", {
      status: "draft",
      created_at: isoNow(),
      data: { class_date: isoNow().slice(0, 10), notes: "Waiting for a spot tomorrow" },
      relations: { member: "lead-habituall-6" },
    }),
    makeRecord("rec-hab-4", SITE, "rcat-hab-maintenance", "Replace spin bike #4", {
      status: "published",
      created_at: isoDaysAgo(5),
      data: { priority: "high", area: "Studio Roma — spin room" },
      relations: { assignee: "demo-user-123" },
    }),
    makeRecord("rec-hab-5", SITE, "rcat-hab-maintenance", "AC filter coworking", {
      status: "draft",
      created_at: isoDaysAgo(2),
      data: { priority: "medium", area: "Coworking Centro" },
      relations: { assignee: "demo-user-123" },
    }),
    makeRecord("rec-hab-6", SITE, "rcat-hab-maintenance", "Restock yoga blocks", {
      status: "archived",
      created_at: isoDaysAgo(10),
      updated_at: isoDaysAgo(8),
      data: { priority: "low", area: "Studio Roma — yoga loft" },
      relations: { assignee: "demo-user-123" },
    }),
  ],
}
