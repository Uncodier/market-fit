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

/** Contrasting pastel field with a smooth linear wash — not blotchy stains. */
const AREA_IMAGE_BACKGROUNDS: Record<WorkspaceArea, string> = {
  marketing: "mint pastel",
  sales: "peach pastel",
  operations: "blush pastel",
  buying: "periwinkle pastel",
  automation: "pale lime pastel",
  applications: "peach pastel",
  finance: "blush pastel",
  reports: "lavender pastel",
  settings: "mint pastel",
}

/** Short object noun so the model is not literal with screen names like "leads". */
export const MODULE_IMAGE_HINTS: Record<string, string> = {
  campaigns: "target",
  segments: "audience tags",
  promotions: "coupon",
  content: "media file",
  contentCreator: "print press",
  assets: "folder",

  salesHome: "sales board",
  pos: "cash register",
  catalog: "product box",
  priceLists: "price tag",
  subscriptions: "membership card",
  sales: "coins",
  leads: "contact cards",
  deals: "briefcase",
  quotations: "quote paper",
  people: "person profile",

  chat: "chat bubble",
  records: "data table",
  orders: "clipboard",
  orderLines: "item list",
  shipments: "parcel",
  controlCenter: "console",
  reservations: "calendar",
  visits: "map pin",
  checkIn: "QR code",
  inventory: "crates",
  printers: "printer",

  bills: "invoice",
  transactions: "payment card",
  purchasesOrders: "shopping cart",
  purchasesSubscriptions: "renewal calendar",
  purchasesQuotes: "inbox tray",
  purchasesLibrary: "archive box",

  aiWorkspace: "house",
  context: "book",
  agentsConfiguration: "robot",
  requirements: "checklist",
  channels: "phone",
  activities: "timeline",
  skills: "brain",
  workflows: "flowchart",

  applicationsDatabase: "database",
  applicationsRepositories: "code folder",
  applicationsSecrets: "key",

  financeReports: "finance chart",
  journalEntries: "ledger",
  chartOfAccounts: "account tree",
  payments: "wallet",

  reportPerformance: "gauge",
  reportOverview: "pie chart",
  reportAnalytics: "bar chart",
  reportTraffic: "globe",
  reportCosts: "cost chart",
  reportSales: "sales chart",
  reportSocial: "heart",

  settingsGeneral: "gear",
  company: "building",
  marketplace: "storefront",
  settingsVisits: "location pin",
  team: "people",
  calendar: "calendar",
  social: "share nodes",
  integrations: "plug",
  billing: "credit card",
  security: "shield",
}

function screenIconSubject(itemKey: string, title: string): string {
  const hint = MODULE_IMAGE_HINTS[itemKey]
  if (hint) return `${hint} app icon`
  const fromTitle = title.trim().toLowerCase()
  return fromTitle ? `${fromTitle} app icon` : "app icon"
}

export function getModuleImagePrompt(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  const subject = screenIconSubject(itemKey, title)
  const color = AREA_IMAGE_COLORS[area]
  const background = AREA_IMAGE_BACKGROUNDS[area]

  return [
    `Volumetric 3D isometric object of a ${subject}, highly recognizable, completely textless, no words and clean surface without any typography`,
    "Photorealistic and lifelike everyday object, standalone item floating purely in mid-air",
    "ZERO contact shadows, NO drop shadow on the floor",
    "Fully solid 3D geometry with highly realistic physically based materials (PBR), authentic textures (lifelike metal, glass, fabric, etc.) with crisp raytraced specular reflections",
    `High-contrast vibrant color palette featuring ${color} as the dominant color`,
    `Set against a standardized, uniform ${background} background with a very subtle smooth linear gradient (even studio wash from slightly lighter to slightly darker, no blobs, no stains, no patchy color spots) to create a consistent, cohesive color-blocked contrast and make the main object pop brightly`,
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
