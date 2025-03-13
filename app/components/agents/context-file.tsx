import { Button } from "@/app/components/ui/button"
import { FileText, Trash2 } from "@/app/components/ui/icons"

interface ContextFileProps {
  id: string
  name: string
  path: string
  onRemove: (id: string) => void
}

export function ContextFile({ id, name, path, onRemove }: ContextFileProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center space-x-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{path}</div>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => onRemove(id)}
        aria-label={`Remove ${name}`}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
} 