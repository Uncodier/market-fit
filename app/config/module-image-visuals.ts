import { publicPromptImageUrl } from "@/app/lib/image-utils"
import type { WorkspaceArea } from "./navigation-areas"

/** Short object noun so the model is not literal with screen names like "leads". */
export const MODULE_IMAGE_HINTS: Record<string, string> = {
  campaigns: "target",
  segments: "audience tags",
  promotions: "coupon",
  content: "play button",
  contentCreator: "classic printer",
  assets: "image folder",

  salesHome: "house",
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
  controlCenter: "check mark",
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

  financeReports: "stack of books",
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

/** Objects with strong silhouettes that benefit from a near edge-to-edge cutout composition. */
export const FULL_SIZE_MODULE_IMAGE_KEYS = new Set([
  "pos",
  "catalog",
  "records",
  "shipments",
  "reservations",
  "inventory",
  "printers",
  "channels",
  "payments",
  "reportTraffic",
  "company",
  "marketplace",
  "calendar",
  "settingsGeneral",
])

const CONTAINER_FREE_MODULE_IMAGE_KEYS = new Set([
  "settingsGeneral",
  "channels",
  "printers",
])

const ALTERNATIVE_MODULE_IMAGE_KEYS = new Set([
  "salesHome",
  "purchasesSubscriptions",
  "payments",
  "integrations",
  "company",
  "purchasesOrders",
  "context",
  "marketplace",
  "reportAnalytics",
  "reportCosts",
  "controlCenter",
])

const SECOND_GENERATION_PASS_MODULE_IMAGE_KEYS = new Set([
  "salesHome",
  "marketplace",
  "company",
  "printers",
  "channels",
  "payments",
  "financeReports",
  "reportAnalytics",
  "reportCosts",
  "controlCenter",
])

const MODULE_IMAGE_PALETTES: Partial<Record<string, string>> = {
  campaigns:
    "Use vivid red with medium-to-high saturation as the unmistakable dominant hue across the target, supported by a smaller harmonious warm accent. Black, charcoal, gray, and white may appear only in small details, shadows, highlights, or separators; do not use pink, orange, neutrals, or any other hue as the dominant color, while maintaining strong contrast, clear separation between adjacent parts, defined edges, and a readable silhouette",
  billing:
    "Use a bright high-contrast palette led by luminous golden yellow and vivid warm orange across the credit card, with light cream highlights and clearly separated surfaces. Do not use blue and black together, do not place dark blue elements on black or charcoal surfaces, and never let black, charcoal, navy, or other dark tones dominate; reserve dark tones for small functional details only. Keep every major shape bright and immediately distinguishable from adjacent parts and the background",
  purchasesOrders:
    "Use a bright high-contrast palette led by luminous golden yellow and vivid warm orange across the shopping cart, with light cream highlights and clearly separated surfaces. Do not use blue and black together, do not place dark blue elements on black or charcoal surfaces, and never let black, charcoal, navy, or other dark tones dominate; reserve dark tones for small functional details only. Keep every major shape bright and immediately distinguishable from adjacent parts and the background",
}

const DEFAULT_MODULE_IMAGE_PALETTE =
  "Choose a simple harmonious palette freely, led by one clearly chromatic dominant hue with medium-to-high saturation and one supporting secondary hue; use only minimal functional accents when they improve recognition. Black, charcoal, gray, and white may appear only in small details, shadows, highlights, or separators and must never dominate the object or occupy large surfaces. Avoid busy multicolor treatment while maintaining strong contrast, clear separation between adjacent parts, defined edges, and a readable silhouette; prioritize icon visibility and clarity over any predetermined color family"

const COMPACT_SECOND_PASS_PALETTE =
  "Choose one clearly chromatic dominant hue with medium-to-high saturation and one supporting secondary hue. Use black, gray, and white only for small details, shadows, or highlights; maintain strong contrast and a readable silhouette"

const COMPACT_FULL_SIZE_COMPOSITION =
  "Use the Apple iOS Calendar, Notes, Contacts, and Reminders icons as references for visual polish, spacing discipline, and clarity rather than copying their symbols or outer app tiles: one recognizable object, full-size at 88 to 92 percent of the canvas, optically centered, evenly balanced, with a narrow consistent safe margin and softly rounded geometry; no app tile, iOS-style squircle, rounded-square container, badge, frame, floor, scenery, or secondary icon"

const MODULE_IMAGE_CLARIFIERS: Partial<Record<string, string>> = {
  salesHome:
    "Show one welcoming detached house with a broad roof, centered front door, and two simple windows; no dashboard, chart, sales board, storefront, office building, garden, street, text, or extra objects",
  financeReports:
    "Show exactly three substantial hardcover accounting books in one neat stack with clearly separated covers and visible page edges; no chart, graph, spreadsheet, loose paper, currency symbol, text, labels, or extra objects",
  content:
    "Show one large triangular play symbol by itself; no screen, media player controls, file, document, or surrounding button container",
  contentCreator:
    "Show one recognizable classic desktop printer with a large sheet of paper; no printing press, modern multifunction copier, or extra objects",
  assets:
    "Show a folder containing one large landscape image thumbnail; no abstract shapes",
  pos:
    "Show one substantial cash register with a clearly visible display and cash drawer; no countertop, shop scene, receipt, payment card, products, or extra objects",
  catalog:
    "Show one retail shelf displaying several clearly separated products; no single box, shopping cart, storefront, or extra objects",
  subscriptions:
    "Show one identification card with a person silhouette and a few simple detail lines; no credit card, membership text, lanyard, or extra objects",
  leads:
    "Show one simple Windows-style user avatar silhouette with only a round head and rounded shoulders or upper torso, centered and large; no face details, arms, lower body, card, group, badge, text, or extra objects",
  people:
    "Show one large magnifying glass centered by itself; no person, document, text, search bar, or extra objects",
  chat:
    "Show one single large message bubble with the familiar clean silhouette of a modern mobile messaging bubble: a horizontally wide body, fully rounded corners, and one small smooth tail integrated into the lower-left edge, centered by itself; no sharp corners, circular bubble, second bubble, Apple logo, app interface, phone, person, text, dots, or extra objects",
  records:
    "Show one spreadsheet sheet with a clear grid of rows and columns and one folded corner; no database cylinder, clipboard, chart, or extra objects",
  controlCenter:
    "Create a completely new Tasks variant as one large bold check mark symbol with a thick rounded stroke, angled upward and centered by itself; make it instantly recognizable as a completed-task tick, with no bird, dove, wings, feathers, olive branch, checklist, clipboard, document, circle, surrounding container, text, badge, or extra objects",
  orderLines:
    "Show only four large seven-segment digital digits reading 12:45; no timer body, clock casing, screen, border, buttons, label, or extra objects",
  shipments:
    "Show one substantial sealed shipping parcel with visible folded flaps and one simple blank label; no delivery truck, warehouse, hand, text, or extra objects",
  reservations:
    "Show one substantial desktop reservation calendar with two large binding rings and one date marked by color only; no clock, checkmark, text, numbers, badge, desk, or extra objects",
  quotations:
    "Show a simple stack of exactly three overlapping paper sheets with clearly visible offset edges; no currency symbol, writing, quotation marks, speech bubble, folder, clipboard, or extra objects",
  visits:
    "Show one visitor identification badge with a person silhouette and lanyard; no map or route",
  checkIn:
    "Show one large handwritten signature stroke with a short underline; no pen, document, QR code, scanner, text, or extra objects",
  inventory:
    "Show exactly three substantial storage crates in one compact stack, with clearly separated silhouettes; no shelf, warehouse, forklift, labels, text, or extra objects",
  printers:
    "Show one compact thermal receipt printer producing one visible receipt; no office printer, inkjet printer, copier, or extra objects",
  channels:
    "Show one classic landline telephone with a separate curved handset resting on top; no smartphone, mobile phone, headset, or extra objects",
  activities:
    "Show one simple four-point AI sparkle star, centered and large; no timeline, clock, robot, multiple stars, text, circle, or extra objects",
  workflows:
    "Show one large, unmistakable lightning bolt in saturated deep violet with a bright pearlescent highlight and crisp dark-violet edges, creating strong luminance and color contrast against the pale lime background; no washed-out tones, arrows, gears, flowchart, network, outline container, or extra objects",
  payments:
    "Show one open leather wallet with a visible bill compartment; no hand, coin, payment card, purse, or extra objects",
  reportTraffic:
    "Show one substantial freestanding globe with simplified continents and a short curved stand; no map pins, chart, arrows, airplane, text, desk, or extra objects",
  reportPerformance:
    "Show one highly readable speedometer-style semicircular gauge with a bold needle pointing upward and three broad colored zones; no chart, dashboard panel, numbers, or extra objects",
  reportAnalytics:
    "Create a completely new analytics variant as exactly three substantial vertical bars rising from left to right, with clearly different heights and one smooth upward trend line crossing their upper halves; no axes, grid, dashboard panel, pie chart, numbers, text, currency symbol, or extra objects",
  reportCosts:
    "Create a completely new cost-report variant as exactly three substantial stacks of thick golden coins, arranged as a clear descending staircase from a tall stack on the left to a short stack on the right; give every coin a visible raised rim and warm metallic highlights, with no chart, line, arrows, axes, grid, dashboard panel, receipt, calculator, banknotes, currency symbol, numbers, text, or extra objects",
  reportSocial:
    "Show one extremely simple solid heart silhouette centered and large, with a smooth clean outline; no chart, graph, counter, engagement badge, social media logo, inner symbol, text, or extra objects",
  company:
    "Show one substantial freestanding office building with a simple entrance and a few broad window rows; no street, trees, skyline, sign, text, base, or extra objects",
  marketplace:
    "Create a completely new marketplace variant as one open market stall with a broad scalloped canopy, a simple waist-high counter, and exactly two large produce crates tucked beneath it; use a wide airy silhouette with no enclosed shop facade, doorway, display window, street, vendor, sign, text, base, or extra objects",
  team:
    "Show exactly three oversized circular person avatar icons filling most of the canvas, arranged as a tight group; no full bodies, tiny icons, text, or surrounding container",
  integrations:
    "Show one unmistakable electrical power plug with two metal prongs and a short curved cable; no socket, puzzle piece, connector nodes, or extra objects",
  social:
    "Show one extremely simple solid heart silhouette centered and large, with a smooth clean outline; no thumbs-up, share nodes, social media logos, inner symbols, text, or extra objects",
  calendar:
    "Show one substantial clean wall-calendar sheet with two large binding rings and a simple blank date grid; no marked date, clock, checkmark, text, numbers, badge, wall, or extra objects",
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
  _area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  const subject = screenIconSubject(itemKey, title)
  const clarifier = MODULE_IMAGE_CLARIFIERS[itemKey]
  const isFullSize = FULL_SIZE_MODULE_IMAGE_KEYS.has(itemKey)
  const isContainerFree = CONTAINER_FREE_MODULE_IMAGE_KEYS.has(itemKey)
  const palette = MODULE_IMAGE_PALETTES[itemKey]
  const isAlternative = ALTERNATIVE_MODULE_IMAGE_KEYS.has(itemKey)
  const needsSecondGenerationPass =
    SECOND_GENERATION_PASS_MODULE_IMAGE_KEYS.has(itemKey)
  const fullSizeComposition = needsSecondGenerationPass
    ? COMPACT_FULL_SIZE_COMPOSITION
    : "Use the Apple iOS Calendar, Notes, Contacts, and Reminders icons as visual references for exceptionally precise icon composition: a single instantly recognizable object, full-size at 88 to 92 percent of the canvas, optically centered, evenly balanced, with a narrow consistent safe margin, polished dimensional layers, softly rounded geometry, and a crisp readable silhouette. Replicate their visual polish, spacing discipline, and clarity rather than copying their symbols or outer app tiles; no app tile, iOS-style squircle, rounded-square container, badge, button, frame, plaque, pedestal, floor, horizon, scenery, or secondary icon"

  return [
    `Front-facing 3D ${subject}, viewed straight on at eye level, centered and symmetrical, no isometric angle and no tilted perspective`,
    clarifier,
    isAlternative &&
      "Create a fresh alternative composition with a distinctly new arrangement and proportions while preserving the same single recognizable subject and minimalist visual language",
    needsSecondGenerationPass &&
      "Generate this as a completely new second-pass render rather than reusing any previous result",
    isContainerFree &&
      "Show only the standalone symbol itself with its natural silhouette completely visible; remove any surrounding icon container, enclosing shell, outer tile, background plate, bezel, frame, or housing that is not an intrinsic functional part of the object",
    isFullSize
      ? fullSizeComposition
      : "Render the subject itself directly on the background, large and filling most of the canvas; do not place it inside an app tile, iOS-style squircle, rounded-square container, badge, button, frame, plaque, or secondary icon",
    "Minimalist design, smooth glossy plastic and frosted glass texture, soft rounded edges",
    palette ?? (needsSecondGenerationPass
      ? COMPACT_SECOND_PASS_PALETTE
      : DEFAULT_MODULE_IMAGE_PALETTE),
    "Keep the composition simple, with one primary symbol, few large components, no tiny details, and strong legibility at small UI sizes",
    "Pearlescent finish, gentle ambient inner glow, soft studio lighting",
    !isFullSize &&
      "Set against a clean, seamless background chosen to provide maximum contrast with the object",
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
