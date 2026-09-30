// Definimos los tipos de estado de los requisitos
export const REQUIREMENT_STATUSES = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'in-progress', name: 'In Progress' },
  { id: 'on-review', name: 'On Review' },
  { id: 'done', name: 'Done' },
  { id: 'validated', name: 'Validated' },
  { id: 'canceled', name: 'Canceled' }
]

// Colores para los diferentes estados
export const STATUS_COLORS: Record<string, string> = {
  'backlog': 'bg-gray-100/20 text-gray-600 dark:text-gray-400 border-gray-300/30',
  'in-progress': 'bg-purple-100/20 text-purple-600 dark:text-purple-400 border-purple-300/30',
  'on-review': 'bg-blue-100/20 text-blue-600 dark:text-blue-400 border-blue-300/30',
  'done': 'bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30',
  'validated': 'bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30',
  'canceled': 'bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30'
}

// Colors for priorities
export const PRIORITY_COLORS: Record<string, string> = {
  'high': 'bg-red-50/60 text-red-600/70 dark:bg-red-900/20 dark:text-red-400/70 border border-red-200/30 dark:border-red-800/30',
  'medium': 'bg-yellow-50/60 text-yellow-600/70 dark:bg-yellow-900/20 dark:text-yellow-400/70 border border-yellow-200/30 dark:border-yellow-800/30',
  'low': 'bg-blue-50/60 text-blue-600/70 dark:bg-blue-900/20 dark:text-blue-400/70 border border-blue-200/30 dark:border-blue-800/30'
}

// Format date to a more readable format (moved outside component)
export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }).format(date);
}

// Interfaz para los filtros de requisitos
export interface RequirementFilters {
  priority: string[]
  status: string[]
  segments: string[]
  completionStatus: string[]
}

// Define type for requirement status
export type RequirementStatusType = "backlog" | "in-progress" | "on-review" | "done" | "validated" | "canceled";
type CompletionStatusType = "pending" | "completed" | "rejected";

export interface Requirement {
  id: string
  title: string
  description: string
  type: "app" | "automation" | "presentation" | "document" | "campaign" | "image" | "video" | "audio" | "report" | "message" | "segment" | "task" | "website"
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  campaigns?: string[]
  campaignNames?: string[]
  budget: number | null
  createdAt: string
  segments: string[]
  segmentNames?: string[]
}

export interface KanbanViewProps {
  requirements: Requirement[]
  onUpdateRequirementStatus: (requirementId: string, newStatus: RequirementStatusType) => Promise<void>
  segments: Array<{ id: string; name: string, description: string }>
  onRequirementClick: (requirement: Requirement) => void
  filters?: RequirementFilters
  onOpenFilters?: () => void
}

// CSS para texto vertical cuando la columna está colapsada
export const KanbanColumnStyles = `
.kanban-writing-mode-vertical {
  writing-mode: vertical-lr;
  text-orientation: mixed;
  transform: rotate(180deg);
  white-space: nowrap;
  letter-spacing: 0.1em;
}
`;

