import { WorkspaceArea } from "./navigation-areas"
import {
  Megaphone,
  Briefcase,
  Zap,
  Smartphone,
  BarChart,
  Home,
  Target,
  Tag,
  FileText,
  Printer,
  Folder,
  BookOpen,
  ClipboardList,
  Cpu,
  DatabaseIcon,
  Archive,
  DollarSign,
  ActivitySquare,
  CreditCard,
  Building,
  Users,
  MessageCircle,
  Search,
  Rocket,
  CheckSquare,
  Phone,
  Activity,
  Brain,
  TrendingUp,
  PieChart,
  Globe,
  Store,
  Send,
  Ticket,
  ListOrdered,
  Repeat,
  CalendarDays,
  ShoppingCart,
  QrCode,
} from "@/app/components/ui/icons"

export const AREA_ICON: Record<WorkspaceArea, React.ComponentType<any>> = {
  marketing: Megaphone,
  sales: Briefcase,
  operations: ActivitySquare,
  buying: ShoppingCart,
  automation: Zap,
  applications: Smartphone,
  reports: BarChart,
}

export const NAV_ITEM_ICON: Record<string, React.ComponentType<any>> = {
    purchasesOrders: ShoppingCart,
    transactions: CreditCard,
    purchasesSubscriptions: Repeat,
    purchasesQuotes: FileText,
    purchasesLibrary: Archive,
    salesHome: Home,
    pos: Store,
    checkIn: QrCode,
    catalog: Archive,
  priceLists: Tag,
  inventory: DatabaseIcon,
  orders: ListOrdered,
  shipments: Send,
  promotions: Ticket,
  subscriptions: Repeat,
  reservations: CalendarDays,
  campaigns: Target,
  segments: Tag,
  content: FileText,
  contentCreator: Printer,
  assets: Folder,
  context: BookOpen,
  agentsConfiguration: Cpu,
  applicationsDatabase: DatabaseIcon,
  applicationsRepositories: Archive,
  sales: DollarSign,
  leads: Users,
  deals: Briefcase,
  quotations: FileText,
  chat: MessageCircle,
  people: Search,
  controlCenter: Rocket,
  requirements: CheckSquare,
  channels: Phone,
  activities: Activity,
  skills: Brain,
  reportPerformance: TrendingUp,
  reportOverview: PieChart,
  reportAnalytics: BarChart,
  reportTraffic: Globe,
  reportCosts: CreditCard,
  reportSales: ActivitySquare,
  financeReports: Building,
  journalEntries: ClipboardList,
  chartOfAccounts: FileText,
}

export type ModulePattern = "mesh-1" | "mesh-2" | "mesh-3" | "mesh-4" | "mesh-5" | "mesh-6" | "mesh-7"

export type ModuleVariant = {
  /** Base icon / ring accent (solid HSL) */
  accent: string
  /** 
   * High contrast ink for icon strokes (darker/saturated in light mode,
   * brighter/clearer in dark mode) so icons pop against the gradient.
   */
  ink: string
  /** Primary tile fill gradient */
  gradient: string
  /** Soft orb wash for depth */
  wash: string
  /** Soft shadow tint matching accent */
  shadow: string
  pattern: ModulePattern
  animated: boolean
  /** Flagship tiles feel slightly elevated */
  elevated: boolean
  /** Orbs (x,y coords and scale) for mesh gradients */
  meshOrbs: {
    color1: string
    color2: string
    color3: string
    color4: string
  }
}

type AreaFamilyConfig = {
  centerHue: number
  defaultPattern: ModulePattern
}

export const AREA_FAMILY: Record<WorkspaceArea, AreaFamilyConfig> = {
  marketing: { centerHue: 355, defaultPattern: "mesh-1" },
  sales: { centerHue: 215, defaultPattern: "mesh-2" },
  operations: { centerHue: 175, defaultPattern: "mesh-3" },
  buying: { centerHue: 38, defaultPattern: "mesh-4" },
  automation: { centerHue: 265, defaultPattern: "mesh-5" },
  applications: { centerHue: 230, defaultPattern: "mesh-6" },
  reports: { centerHue: 75, defaultPattern: "mesh-7" },
}

export const FLAGSHIP_MODULE_KEYS = new Set([
  "campaigns",
  "pos",
  "checkIn",
  "orders",
  "purchasesOrders",
  "agentsConfiguration",
  "applicationsDatabase",
  "reportPerformance",
])

/** Build a rich dual-stop gradient + wash for a hue family. */
function buildVariant(
  hue: number,
  hueB: number,
  angle: number,
  sat: number,
  light: number,
  pattern: ModulePattern,
  animated: boolean,
  elevated = false
): ModuleVariant {
  const accent = `hsl(${hue} ${sat}% ${light}%)`
  // Ink: push lightness far from the gradient mid-point for high contrast.
  // We use CSS variables to make the ink theme-aware (dark mode needs bright ink,
  // light mode needs deep dark ink).
  const isYellowOrLime = (hue > 40 && hue < 90)
  
  // In light mode: very dark, high saturation version of the hue
  // In dark mode: very bright, slightly desaturated version
  const ink = `hsl(${hue} ${Math.min(sat + 15, 100)}% calc(100% - (var(--is-dark, 1) * ${isYellowOrLime ? 20 : 15}% + (1 - var(--is-dark, 1)) * 75%)))`

  const mid = Math.min(light + 12, 72)
  
  // Generate 4 distinct orb colors for the mesh gradient based on the hue family
  const meshOrbs = {
    color1: `hsl(${hue} ${sat}% ${light}% / 0.6)`,
    color2: `hsl(${hueB} ${Math.max(sat - 10, 40)}% ${mid}% / 0.5)`,
    color3: `hsl(${(hue + 25) % 360} ${sat}% ${light}% / 0.4)`,
    color4: `hsl(${(hue - 15 + 360) % 360} ${Math.min(sat + 20, 100)}% ${mid}% / 0.3)`
  }
  
  return {
    accent,
    ink,
    gradient: `linear-gradient(${angle}deg, hsl(${hue} ${sat}% ${mid}% / 0.25) 0%, hsl(${hueB} ${Math.max(sat - 10, 40)}% ${light}% / 0.1) 55%, hsl(${hue} ${sat}% ${mid}% / 0.02) 100%)`,
    wash: `radial-gradient(circle at 30% 25%, hsl(${hue} ${sat}% ${mid}% / 0.35) 0%, transparent 55%), radial-gradient(circle at 80% 90%, hsl(${hueB} ${sat}% ${light}% / 0.25) 0%, transparent 50%)`,
    shadow: `hsl(${hue} ${sat}% ${light}% / 0.28)`,
    pattern,
    animated,
    elevated,
    meshOrbs
  }
}

/**
 * Curated per-module visuals. Same area = same hue family, but each key
 * gets a distinct angle / hue shift / pattern so tiles never look cloned.
 */
export const MODULE_VARIANTS: Record<string, ModuleVariant> = {
  // —— Marketing (coral → rose → magenta) ——
  campaigns: buildVariant(350, 12, 135, 85, 52, "mesh-1", true, true),
  segments: buildVariant(340, 320, 45, 72, 50, "mesh-2", false),
  promotions: buildVariant(8, 28, 200, 80, 54, "mesh-3", false),
  content: buildVariant(355, 330, 90, 68, 48, "mesh-4", false),
  contentCreator: buildVariant(328, 350, 160, 78, 50, "mesh-5", false),
  assets: buildVariant(18, 350, 310, 70, 52, "mesh-6", false),

  // —— Sales (sky → azure → indigo) ——
  pos: buildVariant(210, 230, 135, 88, 50, "mesh-7", true, true),
  catalog: buildVariant(200, 185, 45, 70, 48, "mesh-1", false),
  priceLists: buildVariant(222, 245, 200, 75, 54, "mesh-2", false),
  subscriptions: buildVariant(195, 215, 90, 72, 46, "mesh-3", false),
  sales: buildVariant(215, 200, 160, 80, 48, "mesh-4", false),
  leads: buildVariant(230, 210, 310, 78, 52, "mesh-5", false),
  deals: buildVariant(205, 225, 50, 82, 46, "mesh-6", false),
  quotations: buildVariant(218, 200, 120, 68, 50, "mesh-7", false),
  people: buildVariant(240, 220, 220, 65, 54, "mesh-1", false),

  // —— Operations (teal → cyan → seafoam) ——
  chat: buildVariant(185, 200, 45, 72, 44, "mesh-2", false),
  orders: buildVariant(172, 190, 135, 82, 42, "mesh-3", true, true),
  shipments: buildVariant(190, 170, 200, 75, 46, "mesh-4", false),
  controlCenter: buildVariant(165, 150, 90, 70, 44, "mesh-5", false),
  reservations: buildVariant(178, 195, 310, 68, 48, "mesh-6", false),
  checkIn: buildVariant(175, 190, 135, 80, 46, "mesh-2", true, true),
  inventory: buildVariant(160, 175, 160, 65, 42, "mesh-7", false),

  // —— Buying (amber → gold → soft orange) ——
  purchasesOrders: buildVariant(34, 45, 135, 90, 48, "mesh-1", true, true),
  transactions: buildVariant(15, 25, 120, 85, 45, "mesh-2", true, false),
  purchasesSubscriptions: buildVariant(42, 28, 45, 78, 50, "mesh-2", false),
  purchasesQuotes: buildVariant(28, 40, 200, 82, 52, "mesh-3", false),
  purchasesLibrary: buildVariant(38, 20, 90, 70, 46, "mesh-4", false),

  // —— Automation (violet → periwinkle) ——
  context: buildVariant(255, 270, 45, 65, 54, "mesh-5", false),
  agentsConfiguration: buildVariant(268, 285, 135, 78, 56, "mesh-6", true, true),
  requirements: buildVariant(275, 255, 200, 70, 52, "mesh-7", false),
  channels: buildVariant(248, 265, 90, 68, 54, "mesh-1", false),
  activities: buildVariant(260, 245, 310, 72, 50, "mesh-2", false),
  skills: buildVariant(280, 265, 160, 75, 56, "mesh-3", false),

  // —— Applications (slate → indigo, lower chroma) ——
  applicationsDatabase: buildVariant(225, 245, 135, 58, 48, "mesh-4", true, true),
  applicationsRepositories: buildVariant(235, 220, 45, 48, 50, "mesh-5", false),

  // —— Reports (chartreuse → brand lime) ——
  reportPerformance: buildVariant(72, 88, 135, 95, 42, "mesh-6", true, true),
  reportOverview: buildVariant(78, 65, 45, 80, 40, "mesh-7", false),
  reportAnalytics: buildVariant(68, 90, 200, 85, 38, "mesh-1", false),
  reportTraffic: buildVariant(85, 70, 90, 75, 40, "mesh-2", false),
  reportCosts: buildVariant(55, 75, 310, 88, 42, "mesh-3", false),
  reportSales: buildVariant(80, 95, 160, 82, 40, "mesh-4", false),
  financeReports: buildVariant(62, 85, 145, 88, 40, "mesh-5", true, true),
  journalEntries: buildVariant(65, 75, 180, 75, 42, "mesh-3", false),
  chartOfAccounts: buildVariant(70, 60, 220, 70, 44, "mesh-6", false),
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

/** Fallback for any key not curated yet — still in-family and distinct. */
function deriveVariant(area: WorkspaceArea, itemKey: string): ModuleVariant {
  const family = AREA_FAMILY[area]
  const hash = hashString(itemKey)
  const hueShift = (hash % 41) - 20
  const hue = (family.centerHue + hueShift + 360) % 360
  const hueB = (hue + 18 + (hash % 20)) % 360
  const angle = 40 + (hash % 5) * 55
  let sat = 68 + (hash % 18)
  let light = 46 + (hash % 12)
  if (area === "applications") sat = 45 + (hash % 16)
  if (area === "reports") {
    sat = 82 + (hash % 16)
    light = 38 + (hash % 10)
  }
  const elevated = FLAGSHIP_MODULE_KEYS.has(itemKey)
  return buildVariant(
    hue,
    hueB,
    angle,
    sat,
    light,
    elevated ? family.defaultPattern : `mesh-${(hash % 7) + 1}` as ModulePattern,
    elevated,
    elevated
  )
}

export function getModuleVisual(area: WorkspaceArea, itemKey: string): ModuleVariant {
  return MODULE_VARIANTS[itemKey] ?? deriveVariant(area, itemKey)
}

export function getAreaFamilyAccent(area: WorkspaceArea): string {
  const family = AREA_FAMILY[area]
  if (area === "reports") return "hsl(72 95% 40%)"
  if (area === "applications") return "hsl(230 52% 50%)"
  return `hsl(${family.centerHue} 78% 50%)`
}
