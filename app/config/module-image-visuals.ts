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

/** Contrasting pastel background used to separate each area from its icon. */
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
  controlCenter: "checklist",
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
  workflows: "three linked nodes",

  applicationsDatabase: "database",
  applicationsRepositories: "code folder",
  applicationsSecrets: "key",

  financeReports: "bar chart",
  journalEntries: "ledger",
  chartOfAccounts: "ledger book",
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
    `3D isometric icon of a ${subject}`,
    "Minimalist design, smooth glossy plastic and frosted glass texture, soft rounded edges",
    `Soft pastel color palette featuring ${color}`,
    "Use one or two complementary pastel accent colors on key object details, with clear tonal separation between adjacent parts, defined edges, and a readable silhouette; preserve the glossy glass style and avoid a flat monochrome look",
    "Keep the composition simple, with one primary symbol, few large components, no tiny details, and strong legibility at small UI sizes",
    "Pearlescent finish, gentle ambient inner glow, soft studio lighting",
    `Set against a clean, seamless ${background} gradient background`,
    "Dreamy, modern UI asset style, clean geometry, Octane render, 8k resolution",
  ].join(". ")
}

export function getModuleImageUrl(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  return publicPromptImageUrl(getModuleImagePrompt(area, itemKey, title), 256)
}
