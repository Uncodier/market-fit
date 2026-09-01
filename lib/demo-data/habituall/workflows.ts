import { makeWfStep, makeWfTrigger } from "../factories"

const SITE = "demo-habituall"
const INSTANCE = "remote-habituall-1"
const USER = "demo-user-123"

const trigger = makeWfTrigger({
  id: "wf-hab-trigger-1",
  siteId: SITE,
  instanceId: INSTANCE,
  userId: USER,
  name: "Class confirmation",
  description: "When a member books a class, confirm the spot and send a reminder.",
  kind: "db_event",
  extraTrigger: {
    table: "reservations",
    op: ["insert"],
    db_events: [{ table: "reservations", op: ["insert"] }],
  },
})

export const habituallWorkflows = {
  instance_nodes: [
    trigger,
    makeWfStep({
      id: "wf-hab-step-1",
      parentId: trigger.id,
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Confirm class spot",
      prompt: "Confirm the reservation and assign a studio room if capacity remains.",
      skill: "makinari-rol-workflow-step",
      x: 640,
      y: 40,
      status: "completed",
    }),
    makeWfStep({
      id: "wf-hab-step-2",
      parentId: "wf-hab-step-1",
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Send class reminder",
      prompt: "Message the member 24 hours before start time with studio and instructor.",
      skill: "makinari-rol-content",
      x: 1200,
      y: 40,
    }),
  ],
}
