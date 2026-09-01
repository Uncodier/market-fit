import { isoDaysAgo, makeRecord, makeRecordCategory } from "../factories"

const SITE = "demo-saas-en-123"

const implFields = [
  { id: "imp-phase", name: "phase", type: "select", options: ["discovery", "setup", "training", "handoff"] },
  { id: "imp-owner", name: "owner", type: "relation", relationTarget: "team_member" },
  { id: "imp-account", name: "account", type: "relation", relationTarget: "lead" },
]

const supportFields = [
  { id: "sup-priority", name: "priority", type: "select", options: ["p1", "p2", "p3"] },
  { id: "sup-requester", name: "requester", type: "relation", relationTarget: "lead" },
  { id: "sup-summary", name: "summary", type: "text" },
]

export const saasRecords = {
  record_categories: [
    makeRecordCategory("rcat-saas-impl", SITE, "Implementation projects", implFields, { icon: "rocket" }),
    makeRecordCategory("rcat-saas-support", SITE, "Support tickets", supportFields, { icon: "life-buoy" }),
  ],
  records: [
    makeRecord("rec-saas-1", SITE, "rcat-saas-impl", "DataTech enterprise rollout", {
      status: "published",
      created_at: isoDaysAgo(18),
      data: { phase: "setup" },
      relations: { owner: "demo-user-123", account: "lead-saas-4" },
    }),
    makeRecord("rec-saas-2", SITE, "rcat-saas-impl", "Tech Corp discovery", {
      status: "draft",
      created_at: isoDaysAgo(6),
      data: { phase: "discovery" },
      relations: { owner: "demo-user-123", account: "lead-saas-1" },
    }),
    makeRecord("rec-saas-3", SITE, "rcat-saas-impl", "Innovate LLC training", {
      status: "archived",
      created_at: isoDaysAgo(40),
      updated_at: isoDaysAgo(20),
      data: { phase: "handoff" },
      relations: { owner: "demo-user-123", account: "lead-saas-2" },
    }),
    makeRecord("rec-saas-4", SITE, "rcat-saas-support", "SSO mapping failed", {
      status: "draft",
      created_at: isoDaysAgo(1),
      data: { priority: "p1", summary: "SAML assertion missing groups" },
      relations: { requester: "lead-saas-4" },
    }),
    makeRecord("rec-saas-5", SITE, "rcat-saas-support", "API rate limit question", {
      status: "published",
      created_at: isoDaysAgo(3),
      data: { priority: "p2", summary: "Need 2x quota for launch week" },
      relations: { requester: "lead-saas-4" },
    }),
    makeRecord("rec-saas-6", SITE, "rcat-saas-support", "Invoice copy request", {
      status: "archived",
      created_at: isoDaysAgo(12),
      updated_at: isoDaysAgo(11),
      data: { priority: "p3", summary: "Resent March invoice" },
      relations: { requester: "lead-saas-2" },
    }),
  ],
}
