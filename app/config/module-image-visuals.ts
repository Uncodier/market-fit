import { publicPromptImageUrl } from "@/app/lib/image-utils"
import type { WorkspaceArea } from "./navigation-areas"

const AREA_IMAGE_COLORS: Record<WorkspaceArea, string> = {
  marketing: "red",
  sales: "blue",
  operations: "teal",
  buying: "amber",
  automation: "violet",
  applications: "indigo",
  finance: "emerald",
  reports: "lime",
  settings: "magenta",
}

/** Contrasting pastel field with subtle gradients of the dominant object color. */
const AREA_IMAGE_BACKGROUNDS: Record<WorkspaceArea, string> = {
  marketing: "mint pastel with subtle red gradients",
  sales: "peach pastel with subtle blue gradients",
  operations: "blush pastel with subtle teal gradients",
  buying: "periwinkle pastel with subtle amber gradients",
  automation: "pale lime pastel with subtle violet gradients",
  applications: "peach pastel with subtle indigo gradients",
  finance: "blush pastel with subtle emerald gradients",
  reports: "lavender pastel with subtle lime gradients",
  settings: "mint pastel with subtle magenta gradients",
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
  const background = AREA_IMAGE_BACKGROUNDS[area]

  return [
    `Volumetric 3D isometric object of a ${subject}, highly recognizable, completely textless, no words and clean surface without any typography`,
    "Photorealistic and lifelike everyday object, standalone item floating purely in mid-air",
    "ZERO contact shadows, NO drop shadow on the floor",
    "Fully solid 3D geometry with highly realistic physically based materials (PBR), authentic textures (lifelike metal, glass, fabric, etc.) with crisp raytraced specular reflections",
    `High-contrast vibrant color palette featuring ${color} as the dominant color`,
    `Set against a standardized, uniform ${background} background to create a consistent, cohesive color-blocked contrast and make the main object pop brightly`,
    "Photorealistic studio lighting, global illumination, and a bright rim light around the object to separate it completely from the background",
    "Unreal Engine 5 render, 8k resolution, highly detailed macro photography style",
  ].join(". ")
}

export function getModuleImageUrl(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  return publicPromptImageUrl(getModuleImagePrompt(area, itemKey, title), 256)
}
