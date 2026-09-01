import { makeWfStep, makeWfTrigger } from "../factories"

const SITE = "demo-saas-en-123"
const INSTANCE = "remote-saas-1"
const USER = "demo-user-123"

const trigger = makeWfTrigger({
  id: "wf-saas-trigger-1",
  siteId: SITE,
  instanceId: INSTANCE,
  userId: USER,
  name: "Lead processing",
  description: "Qualify inbound enterprise leads and book a demo.",
  kind: "manual",
})

export const saasWorkflows = {
  instance_nodes: [
    trigger,
    makeWfStep({
      id: "wf-saas-step-1",
      parentId: trigger.id,
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Qualify the account",
      prompt: "Check company size, budget signal, and current tools. Mark the lead qualified or nurture.",
      skill: "makinari-rol-investigate",
      x: 640,
      y: 40,
      status: "completed",
    }),
    makeWfStep({
      id: "wf-saas-step-2",
      parentId: "wf-saas-step-1",
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Book an enterprise demo",
      prompt: "Offer two demo slots this week and create a follow-up task if they do not book.",
      skill: "makinari-rol-workflow-step",
      x: 1200,
      y: 40,
    }),
    makeWfStep({
      id: "wf-saas-step-3",
      parentId: "wf-saas-step-2",
      siteId: SITE,
      instanceId: INSTANCE,
      userId: USER,
      title: "Brief the SDR",
      prompt: "Summarize qualification notes and post them to the deal for the sales rep.",
      skill: "makinari-rol-report",
      x: 1760,
      y: 40,
    }),
  ],
}
