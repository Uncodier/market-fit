import { Badge } from "@/app/components/ui/badge"
import { Check } from "@/app/components/ui/icons"
import { 
  ContextLead, 
  ContextContent, 
  ContextRequirement, 
  ContextTask,
  ContextCampaign
} from "@/app/services/context-entities.service"

interface BaseContextItemProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

interface ContextLeadItemProps extends BaseContextItemProps {
  lead: ContextLead
}

interface ContextContentItemProps extends BaseContextItemProps {
  content: ContextContent
}

interface ContextRequirementItemProps extends BaseContextItemProps {
  requirement: ContextRequirement
}

interface ContextTaskItemProps extends BaseContextItemProps {
  task: ContextTask
}

interface ContextCampaignItemProps extends BaseContextItemProps {
  campaign: ContextCampaign
}

export function ContextLeadItem({ lead, checked, onCheckedChange }: ContextLeadItemProps) {
  const getStatusBadgeVariant = (status: string) => {
    // Always return outline for white badges
    return 'outline'
  }

  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer border ${
        checked ? 'bg-primary/5 border-primary/20' : 'border-transparent'
      }`}
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-center justify-center w-5 h-5 mt-0.5">
        {checked && (
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground truncate flex-1">
            {lead.name}
          </h4>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {lead.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {lead.email}
        </p>
        {(lead.company || lead.position) && (
          <p className="text-xs text-muted-foreground">
            {[lead.position, lead.company].filter(Boolean).join(' at ')}
          </p>
        )}
      </div>
    </div>
  )
}

export function ContextContentItem({ content, checked, onCheckedChange }: ContextContentItemProps) {
  const getTypeBadgeVariant = (type: string) => {
    // Always return outline for white badges
    return 'outline'
  }

  const getStatusBadgeVariant = (status: string) => {
    // Always return outline for white badges
    return 'outline'
  }

  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer border ${
        checked ? 'bg-primary/5 border-primary/20' : 'border-transparent'
      }`}
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-center justify-center w-5 h-5 mt-0.5">
        {checked && (
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground truncate flex-1">
            {content.title}
          </h4>
          <div className="flex gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {content.type.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {content.status}
            </Badge>
          </div>
        </div>
        {content.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {content.description}
          </p>
        )}
      </div>
    </div>
  )
}

export function ContextRequirementItem({ requirement, checked, onCheckedChange }: ContextRequirementItemProps) {
  const getPriorityBadgeVariant = (priority: string) => {
    // Always return outline for white badges
    return 'outline'
  }

  const getStatusBadgeVariant = (status: string) => {
    // Always return outline for white badges
    return 'outline'
  }

  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer border ${
        checked ? 'bg-primary/5 border-primary/20' : 'border-transparent'
      }`}
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-center justify-center w-5 h-5 mt-0.5">
        {checked && (
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground truncate flex-1">
            {requirement.title}
          </h4>
          <div className="flex gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {requirement.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {requirement.completion_status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {requirement.description}
        </p>
      </div>
    </div>
  )
}

export function ContextTaskItem({ task, checked, onCheckedChange }: ContextTaskItemProps) {
  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer border ${
        checked ? 'bg-primary/5 border-primary/20' : 'border-transparent'
      }`}
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-center justify-center w-5 h-5 mt-0.5">
        {checked && (
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground truncate flex-1">
            {task.serial_id && (
              <span className="text-muted-foreground mr-1">#{task.serial_id}</span>
            )}
            {task.title}
          </h4>
          <div className="flex gap-1 items-center flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      </div>
    </div>
  )
}

export function ContextCampaignItem({ campaign, checked, onCheckedChange }: ContextCampaignItemProps) {
  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer border ${
        checked ? 'bg-primary/5 border-primary/20' : 'border-transparent'
      }`}
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-center justify-center w-5 h-5 mt-0.5">
        {checked && (
          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground truncate flex-1">
            {campaign.title}
          </h4>
          <div className="flex gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {campaign.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {campaign.status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {campaign.description}
        </p>
        <p className="text-xs text-muted-foreground">
          Type: {campaign.type}
        </p>
      </div>
    </div>
  )
}
