import type { AgentActivity } from "@/app/types/agents"

export type AgentTemplate = {
  role: string
  name: string
  description: string
  type: "sales" | "support" | "marketing"
  promptTemplate: string
  backstory: string
}

export const AGENT_ROLE_KEY_MAPPING: Record<string, string> = {
  growth_lead: "Growth Lead/Manager",
  data_analyst: "Data Analyst",
  growth_marketer: "Growth Marketer",
  ux_designer: "UX Designer",
  sales: "Sales/CRM Specialist",
  support: "Customer Support",
  content_creator: "Content Creator & Copywriter",
}

export const DEFAULT_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    role: "Growth Lead/Manager",
    name: "Growth Lead/Manager",
    description: "Strategy integration, team coordination, budget management, KPI tracking",
    type: "marketing",
    promptTemplate:
      "You are a Growth Lead/Manager assistant. Your goal is to help with strategy integration, team coordination, budget management, and KPI tracking.",
    backstory:
      "As a former Growth Lead at several successful startups, I've managed marketing teams that achieved 3x user growth in under a year. I specialize in connecting marketing strategies with business goals and excel at coordinating cross-functional teams to execute growth initiatives efficiently.",
  },
  {
    role: "Data Analyst",
    name: "Data Analyst",
    description: "Data analysis, lead qualification, segmentation, performance metrics, optimization",
    type: "marketing",
    promptTemplate:
      "You are a Data Analyst assistant. Your goal is to help with data analysis, lead qualification, segmentation, performance metrics, and optimization.",
    backstory:
      "With 8+ years of experience in marketing analytics, I've helped companies transform raw data into actionable insights. I specialize in customer segmentation, attribution modeling, and performance tracking that drives measurable business results. I've implemented data-driven strategies that increased conversion rates by up to 40%.",
  },
  {
    role: "Growth Marketer",
    name: "Growth Marketer",
    description: "Marketing strategy, omnichannel campaigns, A/B testing, SEO techniques",
    type: "marketing",
    promptTemplate:
      "You are a Growth Marketer assistant. Your goal is to help with marketing strategy, omnichannel campaigns, A/B testing, and SEO techniques.",
    backstory:
      "I've worked with over 50 SaaS companies to develop and execute growth strategies across multiple channels. My expertise includes SEO optimization that's driven 200%+ organic traffic growth, designing conversion-focused marketing funnels, and implementing rigorous A/B testing frameworks that continuously improve campaign performance.",
  },
  {
    role: "UX Designer",
    name: "UX Designer",
    description: "Conversion optimization, UX/UI design for funnel, onboarding experience",
    type: "marketing",
    promptTemplate:
      "You are a UX Designer assistant. Your goal is to help with conversion optimization, UX/UI design for funnel, and onboarding experience.",
    backstory:
      "I've led UX design teams at both startups and enterprise companies, creating intuitive user experiences that drive engagement and retention. I specialize in user research, journey mapping, and conversion-focused design that transforms complex processes into simple, delightful interactions. My redesigns have improved conversion rates by an average of 35%.",
  },
  {
    role: "Sales/CRM Specialist",
    name: "Sales/CRM Specialist",
    description: "Lead management, demos, systematic follow-up, sales cycle",
    type: "sales",
    promptTemplate:
      "You are a Sales/CRM Specialist assistant. Your goal is to help with lead management, demos, systematic follow-up, and sales cycle optimization.",
    backstory:
      "With over a decade in SaaS sales, I've built and optimized sales processes from scratch that generated millions in ARR. I excel at implementing CRM systems that improve lead management efficiency by 50%+ and designing sales playbooks that shorten sales cycles while increasing close rates. I've trained dozens of sales reps who consistently exceed their targets.",
  },
  {
    role: "Customer Support",
    name: "Customer Support",
    description: "Knowledge base management, FAQ development, customer issue escalation",
    type: "support",
    promptTemplate:
      "You are a Customer Support assistant. Your goal is to help with knowledge base management, FAQ development, and customer issue escalation.",
    backstory:
      "I've built support teams from the ground up at several high-growth companies, achieving 98%+ customer satisfaction ratings. I specialize in creating comprehensive knowledge bases that reduce ticket volume by 40% and implementing efficient ticket management systems. I'm particularly skilled at turning customer feedback into actionable product improvements.",
  },
  {
    role: "Content Creator & Copywriter",
    name: "Content Creator & Copywriter",
    description: "Persuasive copywriting, site content, blog posts, email sequences",
    type: "marketing",
    promptTemplate:
      "You are a Content Creator & Copywriter assistant. Your goal is to help with persuasive copywriting, site content, blog posts, and email sequences.",
    backstory:
      "I've written for brands across multiple industries, creating content strategies that drive engagement and conversions. My email campaigns typically achieve 30%+ open rates and 5%+ CTR. I specialize in creating SEO-optimized blog content that ranks in the top 3 positions and crafting compelling website copy that tells a brand's story while driving action.",
  },
]

export function resolveTemplateRole(
  agentId: string,
  isNewAgent: boolean,
  roleParam?: string | null
): string {
  if (!isNewAgent) {
    const byRole = DEFAULT_AGENT_TEMPLATES.find((template) => template.role === agentId)
    if (byRole) return byRole.role

    const mappedRole = AGENT_ROLE_KEY_MAPPING[agentId]
    if (mappedRole) return mappedRole
  }

  if (roleParam) {
    const byParam = DEFAULT_AGENT_TEMPLATES.find((template) => template.role === roleParam)
    if (byParam) return byParam.role

    const mappedParam = AGENT_ROLE_KEY_MAPPING[roleParam]
    if (mappedParam) return mappedParam
  }

  return "Customer Support"
}

export function getDefaultAgentTemplate(
  agentId: string,
  isNewAgent: boolean,
  roleParam?: string | null
): AgentTemplate {
  const role = resolveTemplateRole(agentId, isNewAgent, roleParam)
  return (
    DEFAULT_AGENT_TEMPLATES.find((template) => template.role === role) ||
    DEFAULT_AGENT_TEMPLATES[5]
  )
}

export function getDefaultToolsForRole(_role: string = "") {
  return [
    { id: "search", name: "Web Search", description: "Search the web for real-time information", enabled: false },
    { id: "code", name: "Code Interpreter", description: "Execute code and analyze data", enabled: false },
    { id: "files", name: "File Browser", description: "Browse and access files in the workspace", enabled: false },
    { id: "knowledge", name: "Knowledge Base", description: "Access company knowledge base", enabled: false },
    { id: "calendar", name: "Calendar", description: "Check and manage calendar events", enabled: false },
  ]
}

export function getDefaultIntegrationsForRole() {
  return [
    { id: "slack", name: "Slack", description: "Connect to Slack workspace", connected: false, isOpenClaw: true },
    { id: "salesforce", name: "Salesforce", description: "Access Salesforce CRM data", connected: false, isOpenClaw: true },
    { id: "zendesk", name: "Zendesk", description: "Integrate with Zendesk support tickets", connected: false, isOpenClaw: true },
    { id: "hubspot", name: "HubSpot", description: "Connect to HubSpot CRM", connected: false, isOpenClaw: true },
    { id: "google", name: "Google Workspace", description: "Access Google Docs, Sheets, etc.", connected: false, isOpenClaw: true },
  ]
}

export function getDefaultTriggersForRole() {
  return [
    { id: "message", name: "New Message", description: "Trigger when a new message is received", enabled: false },
    { id: "schedule", name: "Scheduled", description: "Trigger based on a schedule", enabled: false },
    { id: "webhook", name: "Webhook", description: "Trigger via webhook endpoint", enabled: false },
    { id: "email", name: "Email", description: "Trigger on new email", enabled: false },
    { id: "api", name: "API Call", description: "Trigger via API request", enabled: false },
  ]
}

export function getDefaultActivitiesForRole(role: string = ""): AgentActivity[] {
  switch (role) {
    case "Growth Lead/Manager":
      return [
        { id: "gl1", name: "Task Monitoring", description: "Track progress of assigned tasks and ensure timely completion of deliverables", status: "available" },
        { id: "gl2", name: "Stakeholder Coordination", description: "Facilitate decision-making processes with key stakeholders and project owners", status: "available" },
        { id: "gl3", name: "Vendor Management", description: "Monitor vendor relationships, deliverables and ensure alignment with project goals", status: "available" },
        { id: "gl4", name: "Task Validation", description: "Review completed tasks against requirements and provide quality assurance", status: "available" },
        { id: "gl5", name: "Team Coordination", description: "Facilitate cross-functional collaboration, resolve conflicts and align team efforts with strategic goals", status: "available" },
        { id: "gl6", name: "Daily Stand Up", description: "Generate comprehensive daily team progress report with insights and next steps", status: "available" },
        { id: "gl7", name: "Assign Leads", description: "Automatically assign leads to appropriate team members based on criteria and workload", status: "available" },
      ]
    case "Data Analyst":
      return [
        { id: "da1", name: "User Behavior Analysis", description: "Analyze user activity patterns and engagement metrics across website and mobile app", status: "available" },
        { id: "da2", name: "Sales Trend Analysis", description: "Identify and interpret sales patterns, growth opportunities and conversion metrics", status: "available" },
        { id: "da3", name: "Cost Trend Analysis", description: "Monitor expense patterns, identify cost optimization opportunities and ROI evaluation", status: "available" },
        { id: "da4", name: "Cohort Health Monitoring", description: "Track customer cohort performance, retention metrics, and lifetime value analysis", status: "available" },
        { id: "da5", name: "Data-Driven Task Validation", description: "Verify completed tasks against performance data and validate with metric-based evidence", status: "available" },
      ]
    case "Growth Marketer":
      return [
        { id: "mk1", name: "Create Marketing Campaign", description: "Develop a complete marketing campaign with creative, copy, and channel strategy", status: "available" },
        { id: "mk2", name: "SEO Content Optimization", description: "Analyze and optimize website content for better search performance", status: "available" },
        { id: "mk3", name: "A/B Test Design", description: "Create statistically valid A/B tests for landing pages or email campaigns", status: "available" },
        { id: "mk4", name: "Analyze Segments", description: "Identify and analyze customer segments to optimize targeting and conversion strategies", status: "available" },
        { id: "mk5", name: "Campaign Requirements Creation", description: "Develop detailed specifications and requirements documentation for marketing campaigns", status: "available" },
      ]
    case "UX Designer":
      return [
        { id: "ux1", name: "Website Analysis", description: "Conduct comprehensive evaluation of website usability, information architecture and user experience", status: "available" },
        { id: "ux2", name: "Application Analysis", description: "Evaluate mobile and desktop applications for usability issues, interaction design and user flows", status: "available" },
        { id: "ux3", name: "Product Requirements Creation", description: "Develop detailed user-centered product requirements, specifications and design documentation", status: "available" },
      ]
    case "Sales/CRM Specialist":
      return [
        { id: "sl1", name: "Lead Follow-up Management", description: "Systematically track and engage with leads through personalized communication sequences", status: "available" },
        { id: "sl2", name: "Appointment Generation", description: "Create and schedule qualified sales meetings with prospects through effective outreach", status: "available" },
        { id: "sl3", name: "Lead Generation", description: "Identify and qualify potential customers through various channels and targeting strategies", status: "available" },
        { id: "sl4", name: "Lead Profile Research", description: "Analyze prospect backgrounds, needs, and pain points to create personalized sales approaches", status: "available" },
        { id: "sl5", name: "Generate Sales Order", description: "Create complete sales orders with product details, pricing, and customer information", status: "available" },
        { id: "sl7", name: "ICP Mining", description: "Mine and enrich ideal client profile data for your market segments", status: "available" },
      ]
    case "Customer Support":
      return [
        { id: "cs1", name: "Knowledge Base Management", description: "Create, update, and organize product documentation and user guides for self-service support", status: "available" },
        { id: "cs2", name: "FAQ Development", description: "Identify common customer questions and create comprehensive answers for quick resolution", status: "available" },
        { id: "cs3", name: "Escalation Management", description: "Handle complex customer issues and escalate to appropriate teams with complete context", status: "available" },
      ]
    case "Content Creator & Copywriter":
      return [
        { id: "ct1", name: "Content Calendar Creation", description: "Develop a content calendar with themes, topics, and publishing schedule", status: "available" },
        { id: "ct2", name: "Email Sequence Copywriting", description: "Write engaging email sequences for nurturing prospects through the funnel", status: "available" },
        { id: "ct3", name: "Landing Page Copywriting", description: "Create persuasive, conversion-focused copy for landing pages", status: "available" },
      ]
    default:
      return [
        { id: "default1", name: "General Assistance", description: "Provide general assistance and information on various topics", status: "available" },
        { id: "default2", name: "Research Requests", description: "Conduct research on specific topics and provide detailed findings", status: "available" },
        { id: "default3", name: "Recommendations", description: "Provide customized recommendations based on specific requirements", status: "available" },
      ]
  }
}
