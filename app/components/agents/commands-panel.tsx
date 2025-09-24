"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { CheckCircle2, AlertCircle, Clock, FileText, RotateCcw, PlayCircle } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Command } from "@/app/agents/types"
import { getCommands } from "@/app/agents/actions"
import { CommandsSegmentsTable } from "@/app/components/agents/commands-segments-table"
import { CommandList } from "@/app/components/agents/command-list"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { toast } from "sonner"
import { cn } from "@/app/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"

// Maximum size of arrays to process, to prevent freezes
const MAX_ITEMS = 100;
// Maximum size for context field
const MAX_CONTEXT_LENGTH = 1000;
// Maximum depth for nested objects
const MAX_DEPTH = 3;
// Maximum length for base64 strings
const MAX_BASE64_LENGTH = 500;

/**
 * Detects if a string is likely a base64 encoded image
 */
function isBase64Image(str: string): boolean {
  return typeof str === 'string' && 
         str.length > 100 && 
         (str.startsWith('data:image') || 
          /^[a-zA-Z0-9+/]+={0,2}$/.test(str));
}

// Maximum size for base64 encoded images to prevent freezing
const MAX_BASE64_IMAGE_LENGTH = 5000;

/**
 * Safely processes a field that may contain a large base64 image
 * (specifically for logo_url fields that can cause freezing)
 */
function handlePotentialBase64Image(value: any): any {
  if (value === null || value === undefined) return value;
  
  // Handle strings that might be large base64 encoded images
  if (typeof value === 'string') {
    // Check if it's a base64 image and it's very large
    if (value.startsWith('data:image') && value.length > MAX_BASE64_IMAGE_LENGTH) {
      console.warn(`Truncating extremely large base64 image (${value.length} characters)`);
      // Return truncated version
      return value.substring(0, MAX_BASE64_IMAGE_LENGTH) + "... (truncated base64 image)";
    }
  }
  
  // If it's an object, check all its string properties
  if (typeof value === 'object' && !Array.isArray(value)) {
    const result: Record<string, any> = {};
    
    for (const key in value) {
      // Check specifically for logo_url or image fields
      if (key === 'logo_url' || key.includes('image')) {
        result[key] = handlePotentialBase64Image(value[key]);
      } else {
        result[key] = value[key];
      }
    }
    
    return result;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => handlePotentialBase64Image(item));
  }
  
  return value;
}

// Safe object processing with circular reference detection and unlimited depth
function processSafeObject(obj: any, visitedObjects = new WeakSet()): any {
  // Base cases
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    // Handle base64 encoded strings (likely images)
    if (typeof obj === 'string' && isBase64Image(obj) && obj.length > MAX_BASE64_LENGTH) {
      return "[Base64 image removed]";
    }
    return obj;
  }
  
  // Check for circular references
  if (visitedObjects.has(obj)) {
    return "[Circular Reference]";
  }
  
  // Add object to visited set to detect circular references
  visitedObjects.add(obj);
  
  // Handle arrays
  if (Array.isArray(obj)) {
    // Limit array size for performance but allow deep nesting
    if (obj.length > MAX_ITEMS) {
      const limited = obj.slice(0, MAX_ITEMS);
      // Process each item recursively without depth limitation
      return limited.map(item => processSafeObject(item, visitedObjects));
    }
    // Process normal sized arrays
    return obj.map(item => processSafeObject(item, visitedObjects));
  }
  
  // Handle objects - allow unlimited depth
  const result: Record<string, any> = {};
  // Limit number of keys (take first MAX_ITEMS keys) but allow deep nesting
  const keys = Object.keys(obj).slice(0, MAX_ITEMS);
  
  for (const key of keys) {
    try {
      // Special handling for keys that might contain base64 images
      if (key === 'logo_url' || key.includes('image')) {
        result[key] = typeof obj[key] === 'string' && obj[key].length > MAX_BASE64_LENGTH
          ? "[Large image data removed]"
          : processSafeObject(obj[key], visitedObjects);
      } else {
        result[key] = processSafeObject(obj[key], visitedObjects);
      }
    } catch (e) {
      result[key] = "[Error processing value]";
    }
  }
  
  return result;
}

// Cache for sanitized commands to prevent re-processing
const sanitizedCommandsCache = new Map<string, Command>();

// Helper to sanitize potentially problematic commands
function sanitizeCommand(command: Command): Command {
  if (!command) return command;
  
  // Return from cache if available
  if (command.id && sanitizedCommandsCache.has(command.id)) {
    return sanitizedCommandsCache.get(command.id)!;
  }
  
  try {
    // Create a safe copy to avoid modifying the original
    const sanitized = { ...command };
    
    // Check for extremely large context fields that might be JSON containing base64 images
    if (sanitized.context && typeof sanitized.context === 'string') {
      // If the context is very large and might contain a base64 image
      if (sanitized.context.length > 1000 && sanitized.context.includes('data:image')) {
        sanitized.context = "[Base64 image in context removed]";
      } else if (sanitized.context.length > MAX_CONTEXT_LENGTH) {
        // Regular context truncation for non-image content
        sanitized.context = sanitized.context.substring(0, MAX_CONTEXT_LENGTH) + "... (truncated)";
      }
    } else if (typeof sanitized.context === 'object') {
      // If context is an object, process it safely with special handling for images
      try {
        sanitized.context = "[Context object serialized for stability]";
      } catch (err) {
        console.error("Error processing context object:", err);
        sanitized.context = "[Error: Unable to process complex context]";
      }
    }
    
    // For results, tools, targets, and supervisor, only keep the IDs and essential info
    // to avoid deep-copying large structures
    if (sanitized.results) {
      sanitized.results = Array.isArray(sanitized.results) 
        ? sanitized.results.slice(0, MAX_ITEMS).map(() => ({}))
        : [{}];
    }
    
    if (sanitized.tools) {
      sanitized.tools = Array.isArray(sanitized.tools) 
        ? sanitized.tools.slice(0, MAX_ITEMS).map((t) => ({name: t.name, version: t.version}))
        : [{name: "unknown"}];
    }
    
    if (sanitized.targets) {
      sanitized.targets = Array.isArray(sanitized.targets) 
        ? sanitized.targets.slice(0, MAX_ITEMS).map((t) => ({type: t.type, id: t.id}))
        : [{type: "unknown"}];
    }
    
    if (sanitized.supervisor) {
      sanitized.supervisor = [{label: "Supervisor info available"}];
    }
    
    // Store in cache for reuse
    if (sanitized.id) {
      sanitizedCommandsCache.set(sanitized.id, sanitized);
    }
    
    return sanitized;
  } catch (err) {
    console.error("Failed to sanitize command:", err);
    // Return a minimal safe version if sanitization fails
    return {
      id: command.id || "unknown-id",
      task: command.task || "Error processing command",
      description: "This command could not be processed due to complex data structures",
      status: command.status || "failed",
      user_id: command.user_id,
      created_at: command.created_at
    };
  }
}

// Clear cache when number of items gets too large to prevent memory leaks
function clearCacheIfNeeded() {
  if (sanitizedCommandsCache.size > 100) {
    console.log("Clearing sanitized commands cache");
    sanitizedCommandsCache.clear();
  }
}

// Sanitize an array of commands
function sanitizeCommands(commands: Command[]): Command[] {
  if (!commands || !Array.isArray(commands)) return [];
  
  // Limit number of commands to prevent freezing
  const limitedCommands = commands.slice(0, MAX_ITEMS);
  
  // Safe mapping that won't crash if a single command fails
  const result: Command[] = [];
  for (const cmd of limitedCommands) {
    try {
      if (cmd) {
        // Ensure all required fields have valid values to prevent UI errors
        result.push({
          ...cmd,
          id: cmd.id || `unknown-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          status: cmd.status || "unknown",
          task: cmd.task || "Unknown task",
          created_at: cmd.created_at || new Date().toISOString(),
          // Ensure results is an object to prevent rendering issues
          results: cmd.results && typeof cmd.results === 'object' ? cmd.results : (Array.isArray(cmd.results) ? cmd.results : []),
        });
      }
    } catch (err) {
      console.error("Error sanitizing command:", err);
    }
  }
  
  // Clear cache if needed to prevent memory leaks
  clearCacheIfNeeded();
  
  return result;
}

// Error handler function to safely process and log errors
function safelyHandleError(error: any, fallbackMessage: string = "An error occurred"): string {
  try {
    if (typeof error === 'string') {
      return error;
    } else if (error instanceof Error) {
      return error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    } else {
      console.error("Unknown error type:", error);
      return fallbackMessage;
    }
  } catch (e) {
    console.error("Error while handling error:", e);
    return fallbackMessage;
  }
}

export function CommandsPanel() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const { currentSite } = useSite();
  
  // Handle navigation to command detail page
  const handleNavigateToCommand = useCallback((agentId: string, commandId: string) => {
    try {
      // Navigate to command detail route under the current agent (site) context
      router.push(`/agents/${agentId}/${commandId}`);
    } catch (err) {
      console.error("Error navigating to command detail:", err);
    }
  }, [router]);
  
  // Function to load commands
  const loadCommands = async (page: number = 1, append: boolean = false) => {
    if (!currentSite?.id) {
      console.log("No site ID available");
      return;
    }

    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const result = await getCommands(currentSite.id, page);

      if (result.error) {
        console.error("Error:", result.error);
        setError(result.error);
        if (!isInitialLoad) {
          toast.error("Error loading commands.");
        }
      } else {
        if (result.commands && result.commands.length > 0) {
          setCommands(prev => append ? [...prev, ...result.commands!] : result.commands!);
          setHasMore(result.commands.length === 40); // If we got less than 40 items, we've reached the end
          setError(null);
        } else {
          if (!append) {
            setCommands([]);
          }
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error loading commands:", err);
      setError("Failed to load commands");
      if (!isInitialLoad) {
        toast.error("Error loading commands.");
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  // Load more commands
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await loadCommands(nextPage, true);
  };
  
  // Load commands when component mounts or currentSite changes
  useEffect(() => {
    setCurrentPage(1);
    loadCommands(1, false);
    
    // Set up polling for real-time updates with a higher interval to reduce load
    const intervalId = setInterval(() => loadCommands(1, false), 60000); // Update every minute
    
    // Clear interval when unmounting
    return () => clearInterval(intervalId);
  }, [currentSite?.id]);
  
  // Memoized commands list (no status filtering)
  const filteredCommands = useMemo(() => {
    try {
      if (!commands || !Array.isArray(commands) || commands.length === 0) {
        return [];
      }
      return sanitizeCommands(commands);
    } catch (err) {
      console.error("Critical error in command mapping:", err);
      return [];
    }
  }, [commands]);
  
  return (
    <div className="flex flex-col" data-testid="commands-panel">
      <div className="flex-1 p-0">
        <div className="p-8 space-y-4">
          <div className="px-8">
            {loading && commands.length === 0 ? (
              <Card className="overflow-hidden" data-testid="loading-state">
                <div className="relative w-full">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]"><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead className="w-[140px] min-w-[140px] max-w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                        <TableHead className="w-[130px] min-w-[130px] max-w-[130px]"><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead className="w-[110px] min-w-[110px] max-w-[110px]"><Skeleton className="h-4 w-16" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 8 }).map((_, index) => (
                        <TableRow key={index} className="group">
                          <TableCell className="py-2 px-2 sm:px-4">
                            <div className="flex items-start gap-2">
                              <div className="h-5 w-5 flex-shrink-0 mt-0.5">
                                <Skeleton className="h-5 w-5 rounded-full" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <Skeleton className="h-4 w-3/5 mb-2" />
                                <Skeleton className="h-3 w-4/5" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-2 sm:px-4">
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </TableCell>
                          <TableCell className="py-2 px-2 sm:px-4">
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="py-2 px-2 sm:px-4">
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-center px-6 py-4 border-t">
                  <Skeleton className="h-10 w-full max-w-xs" />
                </div>
              </Card>
            ) : filteredCommands.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4" data-testid="empty-state">
                <EmptyCard
                  icon={<FileText className="h-10 w-10 text-muted-foreground" />}
                  title={"No commands found"}
                  description={error ? `Error: ${error}` : "There are no commands to display at this time."}
                  showShadow={false}
                />
              </div>
            ) : (
              <CommandsSegmentsTable
                commands={filteredCommands}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                isLoading={isLoadingMore}
                onRowClick={(cmd) => {
                  if (!cmd?.id) return;
                  handleNavigateToCommand(cmd.agent_id || "", cmd.id);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 