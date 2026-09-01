import { makeWfStep, makeWfTrigger } from "../factories"

const SITE = "demo-ecom-es-456"
const INSTANCE = "remote-ecom-1"
const USER = "demo-user-456"

const trigger = makeWfTrigger({
  id: "wf-ecom-trigger-1",
  siteId: SITE,
  instanceId: INSTANCE,
  userId: USER,
  name: "Cart recovery",
  description: "Recover unpaid shop orders with a follow-up offer.",
  kind: "db_event",
  extraTrigger: {
    table: "sales",
    op: ["insert", "update"],
    db_events: [{ table: "sales", op: ["insert", "update"] }],
  },
})

export const ecomWorkflows = {
  instance_nodes: [
    trigger,
    makeWfStep({
      id: "wf-ecom-step-1",
      parentId: trigger.id,
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Detect unpaid checkout",
      prompt: "If the sale still has amount_due after 2 hours, mark it as abandoned cart.",
      skill: "makinari-rol-investigate",
      x: 640,
      y: 40,
      status: "completed",
    }),
    makeWfStep({
      id: "wf-ecom-step-2",
      parentId: "wf-ecom-step-1",
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Send recovery offer",
      prompt: "Email the shopper with VERANO20 and the items left in the cart.",
      skill: "makinari-rol-content",
      x: 1200,
      y: 40,
    }),
  ],
}
