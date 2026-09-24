import { publicPromptImageUrl } from "@/app/lib/image-utils"
import type { WorkspaceArea } from "./navigation-areas"

const AREA_IMAGE_COLORS: Record<WorkspaceArea, string> = {
  marketing: "coral red and rose",
  sales: "sky blue and indigo",
  operations: "teal and aqua",
  buying: "amber and soft orange",
  automation: "violet and lavender",
  applications: "slate blue and periwinkle",
  finance: "emerald and mint",
  reports: "lime and chartreuse",
  settings: "magenta and pink",
}

export const MODULE_IMAGE_SUBJECTS: Record<string, string> = {
  campaigns: "bullseye target with a campaign flag",
  segments: "grouped audience cards with filter layers",
  promotions: "discount ticket with a small sparkle",
  content: "media document with play button",
  contentCreator: "creative printing press with a color sheet",
  assets: "open folder with media shapes",

  salesHome: "sales dashboard with rising chart",
  pos: "checkout terminal with receipt",
  catalog: "open product box",
  priceLists: "price tag with stacked list",
  subscriptions: "circular arrows around a membership card",
  sales: "coin stack with an upward arrow",
  leads: "three customer profiles with a spark",
  deals: "briefcase with handshake",
  quotations: "quote document with price lines",
  people: "customer profile with magnifying glass",

  chat: "two overlapping chat bubbles",
  records: "structured database table",
  orders: "order clipboard with checkmark",
  orderLines: "itemized order list",
  shipments: "delivery box in motion",
  controlCenter: "mission control console with launch button",
  reservations: "calendar with reserved time slot",
  visits: "location route with visitor pin",
  checkIn: "QR code inside a check-in frame",
  inventory: "stacked warehouse boxes",
  printers: "compact receipt printer",

  bills: "vendor bill with calculator",
  transactions: "payment card with exchange arrows",
  purchasesOrders: "shopping cart with purchase order",
  purchasesSubscriptions: "recurring purchase calendar",
  purchasesQuotes: "supplier quote inside an inbox tray",
  purchasesLibrary: "archive shelf with purchased files",

  aiWorkspace: "home",
  context: "open knowledge book with connected nodes",
  agentsConfiguration: "friendly AI robot head with controls",
  requirements: "requirements checklist with checkmarks",
  channels: "phone handset with connected message nodes",
  activities: "activity pulse with timeline dots",
  skills: "brain with small code brackets",
  workflows: "connected workflow nodes and arrows",

  applicationsDatabase: "database cylinder with a small app window",
  applicationsRepositories: "code repository branch with folder",
  applicationsSecrets: "secure key inside a vault",

  financeReports: "financial report with bar chart and coin",
  journalEntries: "accounting journal with ledger lines",
  chartOfAccounts: "organized account tree with document",
  payments: "digital wallet with payment card",

  reportPerformance: "speed gauge with rising arrow",
  reportOverview: "dashboard with donut chart",
  reportAnalytics: "analytics bars with magnifying lens",
  reportTraffic: "globe with flowing visitor path",
  reportCosts: "expense chart with descending coin",
  reportSales: "sales chart with receipt",
  reportSocial: "social engagement bubbles with heart",

  settingsGeneral: "control sliders and gear",
  company: "modern office building",
  marketplace: "storefront with shopping bag",
  settingsVisits: "map pin with route settings",
  team: "three collaborating profiles",
  calendar: "calendar with highlighted date",
  social: "connected social bubbles with heart",
  integrations: "interlocking connector plugs",
  billing: "invoice with payment card",
  security: "shield with secure lock",
}

export function getModuleImagePrompt(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  const subject = MODULE_IMAGE_SUBJECTS[itemKey] ?? `${title} app symbol`
  const color = AREA_IMAGE_COLORS[area]

  return [
    `3D isometric icon of ${subject}`,
    "minimalist glossy plastic and frosted glass, soft rounded edges",
    `soft pastel ${color} palette`,
    "pearlescent inner glow, soft studio lighting",
    "seamless pastel gradient background",
    "dreamy modern UI asset, clean geometry, Octane render, 8k",
  ].join(". ")
}

export function getModuleImageUrl(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  return publicPromptImageUrl(getModuleImagePrompt(area, itemKey, title), 256)
}
