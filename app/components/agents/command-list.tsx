import { FileText, AlertCircle } from "@/app/components/ui/icons"
import { Command } from "@/app/agents/types"
import { CommandItem, Command as CommandItemType } from "./command-item"

interface CommandListProps {
  commands: Command[]
  hasError?: boolean
  onNavigateToCommand?: (commandId: string) => void
}

export function CommandList({ 
  commands = [], 
  hasError = false, 
  onNavigateToCommand
}: CommandListProps) {
  if (!commands.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-1.5">
          <div className="flex justify-center">
            <FileText className="h-8 w-8 text-muted-foreground opacity-80" />
          </div>
          <h4 className="text-sm font-medium">No commands found</h4>
          <p className="text-xs text-muted-foreground">Run a new command to get started</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {hasError && (
        <div className="p-2 px-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-xs text-amber-700">Using cached data. Connection to server failed.</p>
        </div>
      )}
      <div className="divide-y divide-border/50">
        {commands.map(command => {
          // Transform Command to CommandItemType
          const commandItemData: CommandItemType = {
            id: command.id,
            name: command.task || "Unnamed Command",
            description: command.description || "",
            status: command.status === "running" ? "pending" : 
                    (command.status === "cancelled" ? "failed" : 
                    command.status as "completed" | "failed" | "pending"),
            timestamp: command.updated_at || command.created_at || "",
            originalCommand: command
          };
          
          return (
            <CommandItem 
              key={command.id} 
              command={commandItemData} 
              onNavigate={() => onNavigateToCommand?.(command.id)}
            />
          );
        })}
      </div>
    </>
  );
} 