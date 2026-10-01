import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { ChevronDown, Loader, Tag, Trash2, User } from "@/app/components/ui/icons"

interface LeadsBulkActionsProps {
  isLoading: boolean
  onCancel: () => void
  onAssign: () => void
  onStatusChange: (status: string) => void
  onDelete: () => void
}

export function LeadsBulkActions({
  isLoading,
  onCancel,
  onAssign,
  onStatusChange,
  onDelete,
}: LeadsBulkActionsProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-4 overflow-hidden">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          Choose bulk action
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 gap-2 rounded-full px-4"
            onClick={onAssign}
            disabled={isLoading}
          >
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
            Assign to me
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" disabled={isLoading}>
                <Tag className="h-4 w-4" />
                Change Status
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {["new", "contacted", "qualified", "cold", "converted", "lost", "not_qualified"].map(status => (
                <DropdownMenuItem key={status} onClick={() => onStatusChange(status)} className="capitalize">
                  {status.replace('_', ' ')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 gap-2 rounded-full px-4 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}