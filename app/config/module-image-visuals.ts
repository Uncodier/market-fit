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
  content: "play button",
  contentCreator: "classic printer",
  assets: "image folder",

  salesHome: "sales board",
  pos: "cash register",
  catalog: "product shelf",
  priceLists: "price tag",
  subscriptions: "ID card",
  sales: "coins",
  leads: "user avatar",
  deals: "briefcase",
  quotations: "stack of papers",
  people: "magnifying glass",

  chat: "chat bubble",
  records: "spreadsheet sheet",
  orders: "clipboard",
  orderLines: "digital numbers",
  shipments: "parcel",
  controlCenter: "checklist",
  reservations: "calendar",
  visits: "visitor ID badge",
  checkIn: "signature",
  inventory: "crates",
  printers: "thermal printer",

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
  channels: "classic telephone",
  activities: "AI sparkle",
  skills: "brain",
  workflows: "lightning bolt",

  applicationsDatabase: "database",
  applicationsRepositories: "code folder",
  applicationsSecrets: "key",

  financeReports: "bar chart",
  journalEntries: "ledger",
  chartOfAccounts: "ledger book",
  payments: "wallet",

  reportPerformance: "speedometer gauge",
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
  team: "large avatar group",
  calendar: "calendar",
  social: "heart",
  integrations: "plug",
  billing: "credit card",
  security: "shield",
}

const MODULE_IMAGE_CLARIFIERS: Partial<Record<string, string>> = {
  content:
    "Show one large triangular play symbol by itself; no screen, media player controls, file, document, or surrounding button container",
  contentCreator:
    "Show one recognizable classic desktop printer with a large sheet of paper; no printing press, modern multifunction copier, or extra objects",
  assets:
    "Show a folder containing one large landscape image thumbnail; no abstract shapes",
  catalog:
    "Show one retail shelf displaying several clearly separated products; no single box, shopping cart, storefront, or extra objects",
  subscriptions:
    "Show one identification card with a person silhouette and a few simple detail lines; no credit card, membership text, lanyard, or extra objects",
  leads:
    "Show one simple Windows-style user avatar silhouette with only a round head and rounded shoulders or upper torso, centered and large; no face details, arms, lower body, card, group, badge, text, or extra objects",
  people:
    "Show one large magnifying glass centered by itself; no person, document, text, search bar, or extra objects",
  chat:
    "Show one single large speech bubble with a round, nearly circular body and one short tail, centered by itself; no rectangular or pill-shaped bubble, second bubble, phone, person, text, or extra objects",
  records:
    "Show one spreadsheet sheet with a clear grid of rows and columns and one folded corner; no database cylinder, clipboard, chart, or extra objects",
  orderLines:
    "Show only four large seven-segment digital digits reading 12:45; no timer body, clock casing, screen, border, buttons, label, or extra objects",
  quotations:
    "Show a simple stack of exactly three overlapping paper sheets with clearly visible offset edges; no currency symbol, writing, quotation marks, speech bubble, folder, clipboard, or extra objects",
  visits:
    "Show one visitor identification badge with a person silhouette and lanyard; no map or route",
  checkIn:
    "Show one large handwritten signature stroke with a short underline; no pen, document, QR code, scanner, text, or extra objects",
  printers:
    "Show one compact thermal receipt printer producing one visible receipt; no office printer, inkjet printer, copier, or extra objects",
  channels:
    "Show one classic landline telephone with a separate curved handset resting on top; no smartphone, mobile phone, headset, or extra objects",
  activities:
    "Show one simple four-point AI sparkle star, centered and large; no timeline, clock, robot, multiple stars, text, circle, or extra objects",
  workflows:
    "Show one large, unmistakable lightning bolt; no arrows, gears, flowchart, network, or extra objects",
  payments:
    "Show one open leather wallet with a visible bill compartment; no hand, coin, payment card, purse, or extra objects",
  reportPerformance:
    "Show one highly readable speedometer-style semicircular gauge with a bold needle pointing upward and three broad colored zones; no chart, dashboard panel, numbers, or extra objects",
  team:
    "Show exactly three oversized circular person avatar icons filling most of the canvas, arranged as a tight group; no full bodies, tiny icons, text, or surrounding container",
  integrations:
    "Show one unmistakable electrical power plug with two metal prongs and a short curved cable; no socket, puzzle piece, connector nodes, or extra objects",
  social:
    "Show one extremely simple solid heart silhouette centered and large, with a smooth clean outline; no thumbs-up, share nodes, social media logos, inner symbols, text, or extra objects",
  security:
    "Show one extremely simple solid shield silhouette centered and large, with a smooth clean outline; no lock, key, checkmark, API text, inner symbols, badge, border, or extra objects",
}

function screenIconSubject(itemKey: string, title: string): string {
  const hint = MODULE_IMAGE_HINTS[itemKey]
  if (hint) return hint
  const fromTitle = title.trim().toLowerCase()
  return fromTitle || "simple object"
}

export function getModuleImagePrompt(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  const subject = screenIconSubject(itemKey, title)
  const color = AREA_IMAGE_COLORS[area]
  const background = AREA_IMAGE_BACKGROUNDS[area]
  const clarifier = MODULE_IMAGE_CLARIFIERS[itemKey]

  return [
    `Front-facing 3D ${subject}, viewed straight on at eye level, centered and symmetrical, no isometric angle and no tilted perspective`,
    clarifier,
    "Render the subject itself directly on the background, large and filling most of the canvas; do not place it inside an app tile, iOS-style squircle, rounded-square container, badge, button, frame, plaque, or secondary icon",
    "Minimalist design, smooth glossy plastic and frosted glass texture, soft rounded edges",
    `Soft pastel color palette featuring ${color}`,
    "Use one or two complementary pastel accent colors on key object details, with clear tonal separation between adjacent parts, defined edges, and a readable silhouette; preserve the glossy glass style and avoid a flat monochrome look",
    "Keep the composition simple, with one primary symbol, few large components, no tiny details, and strong legibility at small UI sizes",
    "Pearlescent finish, gentle ambient inner glow, soft studio lighting",
    `Set against a clean, seamless ${background} gradient background`,
    "Dreamy, modern UI asset style, clean geometry, Octane render, 8k resolution",
  ].filter(Boolean).join(". ")
}

export function getModuleImageUrl(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  return publicPromptImageUrl(getModuleImagePrompt(area, itemKey, title), 256)
}
