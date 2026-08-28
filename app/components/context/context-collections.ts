import { WorkspaceArea } from "@/app/config/navigation-areas"
import { 
  Users, 
  FileVideo, 
  Target, 
  CheckSquare, 
  Rocket, 
  FileText, 
  Briefcase, 
  TableRows 
} from "@/app/components/ui/icons"

export type ContextCollectionKey = 
  | "leads" 
  | "contents" 
  | "campaigns" 
  | "requirements" 
  | "tasks" 
  | "quotations" 
  | "deals" 
  | "records"

export interface ContextCollection {
  key: ContextCollectionKey
  label: string
  navKey: string // Matches the AreaNavItem key in navigation-areas.ts
  icon: React.ComponentType<any>
}

export const CONTEXT_COLLECTIONS: ContextCollection[] = [
  {
    key: "leads",
    label: "Leads",
    navKey: "leads",
    icon: Users
  },
  {
    key: "contents",
    label: "Content",
    navKey: "content",
    icon: FileVideo
  },
  {
    key: "campaigns",
    label: "Campaigns",
    navKey: "campaigns",
    icon: Target
  },
  {
    key: "requirements",
    label: "Requirements",
    navKey: "requirements",
    icon: CheckSquare
  },
  {
    key: "tasks",
    label: "Tasks",
    navKey: "controlCenter",
    icon: Rocket
  },
  {
    key: "quotations",
    label: "Quotations",
    navKey: "quotations",
    icon: FileText
  },
  {
    key: "deals",
    label: "Deals",
    navKey: "deals",
    icon: Briefcase
  },
  {
    key: "records",
    label: "Records",
    navKey: "records",
    icon: TableRows
  }
]
