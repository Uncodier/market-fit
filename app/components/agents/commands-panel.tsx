"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { CheckCircle2, AlertCircle, Clock, FileText, RotateCcw, PlayCircle } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { Command } from "@/app/agents/types"
import { getCommands } from "@/app/agents/actions"
import { CommandsTable } from "@/app/components/agents/commands-table"
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
  const [activeTab, setActiveTab] = useState<string>("completed");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const { currentSite } = useSite();
  
  // Handle navigation to command detail page
  const handleNavigateToCommand = useCallback((commandId: string) => {
    try {
      const agentId = currentSite?.id || 'default';
      router.push(`/agents/${agentId}/${commandId}`);
    } catch (err) {
      console.error("Error navigating to command detail:", err);
    }
  }, [router, currentSite?.id]);
  
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
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // Safely filter commands based on active tab
  const safeFilter = (command: Command | null | undefined, status: string): boolean => {
    if (!command) return false;
    return command.status === status;
  };
  
  // Memoized filtered commands
  const filteredCommands = useMemo(() => {
    try {
      if (!commands || !Array.isArray(commands) || commands.length === 0) {
        return [];
      }
      
      const isCompletedTab = activeTab === "completed";
      const isRunningTab = activeTab === "running";
      const isFailedTab = activeTab === "failed";
      
      return commands.filter(command => {
        if (!command) return false;
        
        try {
          const status = command.status;
          if (isCompletedTab && status === "completed") return true;
          if (isRunningTab && (status === "running" || status === "pending")) return true;
          if (isFailedTab && (status === "failed" || status === "cancelled")) return true;
          return false;
        } catch (err) {
          console.error("Error filtering command:", err);
          return false;
        }
      });
    } catch (err) {
      console.error("Critical error in command filtering:", err);
      return [];
    }
  }, [commands, activeTab]);
  
  // Count commands by status
  const { completedCount, runningCount, failedCount } = useMemo(() => {
    const defaultCounts = { completedCount: 0, runningCount: 0, failedCount: 0 };
    
    if (!commands || !Array.isArray(commands) || commands.length === 0) {
      return defaultCounts;
    }
    
    try {
      return commands.reduce((acc, command) => {
        if (!command) return acc;
        
        const status = String(command.status || "");
        if (status === "completed") acc.completedCount++;
        else if (status === "running" || status === "pending") acc.runningCount++;
        else if (status === "failed" || status === "cancelled") acc.failedCount++;
        
        return acc;
      }, { ...defaultCounts });
    } catch (err) {
      console.error("Error counting commands:", err);
      return defaultCounts;
    }
  }, [commands]);
  
  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="commands-panel">
      {/* Panel Header with Tabs */}
      <div className="border-b min-h-[71px] bg-background/95 backdrop-blur-sm">
        <div className="px-1.5 pt-1.5 pb-1.5 h-full flex items-center">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
              <TabsTrigger 
                value="completed" 
                data-testid="completed-tab"
                className="text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Completed
              </TabsTrigger>
              <TabsTrigger 
                value="running" 
                data-testid="running-tab"
                className="text-xs"
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                Running
                {runningCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">
                    {runningCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="failed" 
                data-testid="failed-tab"
                className="text-xs"
              >
                <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                Failed
                {failedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">
                    {failedCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-0">
        {loading && commands.length === 0 ? (
          <div className="divide-y divide-border/50" data-testid="loading-state">
            {[1, 2, 3].map((item) => (
              <div key={item} className="px-4 py-3.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <Skeleton className="h-4 w-48" data-testid="loading-skeleton" />
                      <Skeleton className="h-4 w-16" data-testid="loading-skeleton" />
                    </div>
                    <Skeleton className="h-3 w-full mb-2" data-testid="loading-skeleton" />
                    <Skeleton className="h-3 w-full mb-2" data-testid="loading-skeleton" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-2 w-16" data-testid="loading-skeleton" />
                      <Skeleton className="h-2 w-16" data-testid="loading-skeleton" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4" data-testid="empty-state">
            <EmptyCard
              icon={<FileText className="h-10 w-10 text-muted-foreground" />}
              title={`No ${activeTab} commands found`}
              description={error ? `Error: ${error}` : "There are no commands to display at this time."}
              showShadow={false}
            />
          </div>
        ) : (
          <>
            <CommandList 
              commands={filteredCommands} 
              hasError={!!error} 
              onNavigateToCommand={handleNavigateToCommand}
              agentId={currentSite?.id || 'default'}
            />
            {hasMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full max-w-xs mx-4"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 