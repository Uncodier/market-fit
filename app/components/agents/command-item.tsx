import { Badge } from "@/app/components/ui/badge"
import { CheckCircle2, AlertCircle, PlayCircle } from "@/app/components/ui/icons"
import { useState, useMemo, useCallback, memo } from "react"
import { Command as FullCommand } from "@/app/agents/types"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"

export interface Command {
  id: string
  name: string
  description: string
  status: "completed" | "failed" | "pending"
  timestamp: string
  duration?: string
  errorMessage?: string
  // Reference to the original command data
  originalCommand?: FullCommand
}

interface CommandItemProps {
  command: Command
  onNavigate?: () => void
  agentId?: string
}

// Memoized CommandItem component to prevent excessive re-renders
export const CommandItem = memo(function CommandItem({ command, onNavigate, agentId }: CommandItemProps) {
  const router = useRouter();

  // Handle navigation to command detail
  const handleCommandClick = useCallback(() => {
    try {
      if (onNavigate) {
        onNavigate();
      } else {
        const targetAgentId = agentId || 'default'; // Usar el ID del agente si está disponible, sino usar 'default'
        router.push(`/agents/${targetAgentId}/${command.id}`);
      }
    } catch (error) {
      console.error("Error navigating to command detail:", error);
    }
  }, [command.id, router, onNavigate, agentId]);

  const getStatusIcon = () => {
    try {
      switch (command?.status) {
        case "completed":
          return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
        case "failed":
          return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
        default:
          return <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />;
      }
    } catch (error) {
      console.error("Error getting status icon:", error);
      return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    try {
      switch (command?.status) {
        case "completed":
          return <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Completed</Badge>;
        case "failed":
          return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Failed</Badge>;
        default:
          return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
      }
    } catch (error) {
      console.error("Error getting status badge:", error);
      return <Badge variant="outline" className="text-[10px]">Unknown</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error("Invalid date format:", dateString);
      return "";
    }
  };

  // Safely render error message
  const renderErrorMessage = () => {
    if (!command?.errorMessage) return null;
    
    try {
      return (
        <div className="mt-1.5 px-2 py-1 bg-destructive/5 border border-destructive/10 rounded text-[10px] text-destructive">
          {String(command.errorMessage).substring(0, 500)}
          {String(command.errorMessage).length > 500 ? "..." : ""}
        </div>
      );
    } catch (error) {
      console.error("Error rendering error message:", error);
      return null;
    }
  };
  
  // Guard against null command
  if (!command) {
    return (
      <div className="border-b border-border/50 px-4 py-3.5">
        <div className="text-xs text-destructive">Error: Invalid command data</div>
      </div>
    );
  }
  
  try {
    return (
      <div 
        className="border-b border-border/50 transition-colors px-4 py-3.5 hover:bg-muted/30 cursor-pointer"
        onClick={handleCommandClick}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-sm truncate">{command.name || "Unnamed Command"}</h4>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground/70 mb-1.5 truncate">
              {command.description || "No description"}
            </p>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
              {command.duration && <span>{command.duration}</span>}
              {command.originalCommand?.completion_date && (
                <span>{formatDate(command.originalCommand.completion_date)}</span>
              )}
            </div>
            {command.status === "failed" && renderErrorMessage()}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error rendering command item:", error);
    return (
      <div className="border-b border-border/50 px-4 py-3.5">
        <div className="text-xs text-destructive">Error rendering command: {String(error)}</div>
      </div>
    );
  }
}); 