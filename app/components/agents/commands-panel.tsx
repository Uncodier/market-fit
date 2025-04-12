"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { CheckCircle2, AlertCircle, Clock, FileText, RotateCcw, PlayCircle } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { Command } from "@/app/agents/types"
import { getCommands, getMockCommands } from "@/app/agents/actions"
import { CommandsTable } from "@/app/components/agents/commands-table"
import { CommandList } from "@/app/components/agents/command-list"
import { toast } from "sonner"
import { cn } from "@/app/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useRouter } from "next/navigation"

// Maximum size of arrays to process, to prevent freezes
const MAX_ITEMS = 100;
// Maximum size for context field
const MAX_CONTEXT_LENGTH = 1000;
// Maximum depth for nested objects
const MAX_DEPTH = 3;
// Maximum length for base64 strings
const MAX_BASE64_LENGTH = 500;

// Example commands for fallback
const exampleCommands: Command[] = [
  {
    id: "example-cmd-1",
    task: "Generate SEO Content",
    description: "Create SEO optimized content for blog post",
    status: "completed",
    user_id: "user123",
    created_at: "2024-01-30T10:15:00Z",
    updated_at: "2024-01-30T10:15:45Z",
    completion_date: "2024-01-30T10:15:45Z",
    duration: 45000
  },
  {
    id: "example-cmd-2",
    task: "Analyze Keyword Density",
    description: "Check keyword usage and suggest improvements",
    status: "completed",
    user_id: "user123",
    created_at: "2024-01-30T09:45:00Z",
    updated_at: "2024-01-30T09:45:12Z",
    completion_date: "2024-01-30T09:45:12Z",
    duration: 12000
  },
  {
    id: "example-cmd-3",
    task: "Generate Meta Descriptions",
    description: "Create meta descriptions for 5 new blog posts",
    status: "failed",
    user_id: "user123",
    created_at: "2024-01-29T16:20:00Z",
    updated_at: "2024-01-29T16:20:30Z",
    context: "API rate limit exceeded"
  },
  {
    id: "example-cmd-4",
    task: "Update Content Links",
    description: "Update internal links in existing content",
    status: "pending",
    user_id: "user123",
    created_at: "2024-01-31T11:30:00Z",
    updated_at: "2024-01-31T11:30:00Z"
  }
];

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

/**
 * Safely processes nested objects to prevent circular references
 * and limit object depth to prevent rendering issues
 */
function processSafeObject(obj: any, currentDepth = 0, visitedObjects = new WeakSet()): any {
  // Return simple values directly
  if (obj === null || obj === undefined) return obj;
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
  
  // Prevent too deep recursion
  if (currentDepth >= MAX_DEPTH) {
    return "[Object too deeply nested]";
  }
  
  // Add object to visited set to detect circular references
  visitedObjects.add(obj);
  
  // Handle arrays
  if (Array.isArray(obj)) {
    // Limit array size
    if (obj.length > MAX_ITEMS) {
      const limited = obj.slice(0, MAX_ITEMS);
      // Process each item recursively with increased depth
      return limited.map(item => processSafeObject(item, currentDepth + 1, visitedObjects));
    }
    // Process normal sized arrays
    return obj.map(item => processSafeObject(item, currentDepth + 1, visitedObjects));
  }
  
  // Handle objects
  const result: Record<string, any> = {};
  // Limit number of keys (take first MAX_ITEMS keys)
  const keys = Object.keys(obj).slice(0, MAX_ITEMS);
  
  for (const key of keys) {
    try {
      // Special handling for keys that might contain base64 images
      if (key === 'logo_url' || key.includes('image')) {
        result[key] = typeof obj[key] === 'string' && obj[key].length > MAX_BASE64_LENGTH
          ? "[Large image data removed]"
          : processSafeObject(obj[key], currentDepth + 1, visitedObjects);
      } else {
        result[key] = processSafeObject(obj[key], currentDepth + 1, visitedObjects);
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
  const router = useRouter();
  
  // Handle navigation to command detail page
  const handleNavigateToCommand = useCallback((commandId: string) => {
    try {
      router.push(`/agents/command/${commandId}`);
    } catch (err) {
      console.error("Error navigating to command detail:", err);
    }
  }, [router]);
  
  // Function to load commands
  const loadCommands = async () => {
    // Prevent loading when the component is already in a loading state
    if (loading && !isInitialLoad) {
      console.log("Skipping load while already loading...");
      return;
    }
    
    try {
      setLoading(true);
      console.log("Loading commands...");
      
      // Use a timeout to prevent UI freezing from network requests
      const result = await Promise.race([
        getCommands(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Command loading timed out")), 10000)
        )
      ]) as {commands?: Command[], error?: string};
      
      if (result.error) {
        console.error("Error:", result.error);
        setError(safelyHandleError(result.error, "Failed to load commands"));
        
        // Show toast only if it's not the initial load
        if (!isInitialLoad) {
          toast.error("Error loading commands. Using cached data.");
        }
        
        // Get mock data if we don't have commands or use existing as fallback
        if (!commands || commands.length === 0) {
          try {
            const mockData = await getMockCommands();
            // Sanitize commands before state update to avoid freezing the UI
            const sanitizedMockCommands = sanitizeCommands(mockData || []);
            setCommands(sanitizedMockCommands);
          } catch (mockErr) {
            console.error("Error loading mock data:", mockErr);
            // Ensure example commands are sanitized too
            const sanitizedExampleCommands = sanitizeCommands(exampleCommands || []);
            setCommands(sanitizedExampleCommands);
          }
        }
      } else {
        console.log(`Fetched ${result.commands?.length || 0} commands`);
        
        // Only update state if there are actual commands to avoid unnecessary renders
        if (result.commands && result.commands.length > 0) {
          // Sanitize commands before state update to avoid freezing the UI
          const sanitizedCommands = sanitizeCommands(result.commands || []);
          setCommands(sanitizedCommands);
          setError(null);
        } else {
          // Set empty array but don't clear error if already set
          setCommands([]);
        }
      }
    } catch (err) {
      console.error("Error loading commands:", err);
      setError(safelyHandleError(err, "Failed to load commands"));
      
      // Use mock data only if we don't have commands already
      if (!commands || commands.length === 0) {
        try {
          const mockData = await getMockCommands();
          // Sanitize commands before state update to avoid freezing the UI
          const sanitizedMockCommands = sanitizeCommands(mockData || []);
          setCommands(sanitizedMockCommands);
        } catch (mockErr) {
          console.error("Error loading mock data:", mockErr);
          // Ensure example commands are sanitized too
          const sanitizedExampleCommands = sanitizeCommands(exampleCommands || []);
          setCommands(sanitizedExampleCommands);
        }
      }
      
      // Show toast only if it's not the initial load
      if (!isInitialLoad) {
        toast.error("Error loading commands. Using cached data.");
      }
    } finally {
      setLoading(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };
  
  // Load commands when component mounts
  useEffect(() => {
    loadCommands();
    
    // Set up polling for real-time updates with a higher interval to reduce load
    const intervalId = setInterval(loadCommands, 60000); // Update every minute (increased from 30s)
    
    // Clear interval when unmounting
    return () => clearInterval(intervalId);
  }, []);
  
  // Handle tab change without triggering loadCommands
  const handleTabChange = (value: string) => {
    // Just update the active tab, don't load commands again
    setActiveTab(value);
  };
  
  // Safely filter commands based on active tab
  const safeFilter = (command: Command | null | undefined, status: string): boolean => {
    if (!command) return false;
    return command.status === status;
  };
  
  // Memoized filtered commands with better dependency tracking and error handling
  const filteredCommands = useMemo(() => {
    try {
      // Return empty array immediately if no commands or empty array to prevent processing
      if (!commands || !Array.isArray(commands) || commands.length === 0) {
        return [];
      }
      
      // Create a stable reference to the commands we need to process
      // Limited to MAX_ITEMS to prevent UI freezing with extremely large datasets
      const commandsToProcess = commands.slice(0, MAX_ITEMS);
      
      // Separate logic into simple stable constants for better optimization
      const isCompletedTab = activeTab === "completed";
      const isRunningTab = activeTab === "running";
      const isFailedTab = activeTab === "failed";
      
      // Use simple for loop instead of multiple filters for better performance
      const filtered = [];
      for (let i = 0; i < commandsToProcess.length; i++) {
        const command = commandsToProcess[i];
        if (!command) continue;
        
        try {
          const status = command.status;
          // Early return conditions
          if (isCompletedTab && status === "completed") {
            filtered.push(command);
          } else if (isRunningTab && (status === "running" || status === "pending")) {
            filtered.push(command);
          } else if (isFailedTab && (status === "failed" || status === "cancelled")) {
            filtered.push(command);
          }
        } catch (err) {
          console.error("Error filtering command:", err);
          // Skip problematic command
        }
      }
      
      return filtered;
    } catch (err) {
      console.error("Critical error in command filtering:", err);
      return []; // Return empty array if there's an error during filtering
    }
  }, [commands, activeTab]);
  
  // Count commands by status with improved performance
  const { completedCount, runningCount, failedCount } = useMemo(() => {
    // Default values to prevent rendering errors
    const defaultCounts = { completedCount: 0, runningCount: 0, failedCount: 0 };
    
    // Early return if no commands to avoid unnecessary work
    if (!commands || !Array.isArray(commands) || commands.length === 0) {
      return defaultCounts;
    }
    
    try {
      // Use a single pass through the array instead of multiple filters
      let completed = 0, running = 0, failed = 0;
      
      // Limit to MAX_ITEMS to prevent performance issues
      const itemsToCount = Math.min(commands.length, MAX_ITEMS);
      
      for (let i = 0; i < itemsToCount; i++) {
        const command = commands[i];
        if (!command) continue;
        
        // Use string comparison for more stability
        const status = String(command.status || "");
        if (status === "completed") {
          completed++;
        } else if (status === "running" || status === "pending") {
          running++;
        } else if (status === "failed" || status === "cancelled") {
          failed++;
        }
      }
      
      return { completedCount: completed, runningCount: running, failedCount: failed };
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
          <div className="text-center p-8" data-testid="empty-state">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No {activeTab} commands found</p>
            {error && (
              <p className="text-xs text-destructive mt-2" data-testid="error-message">
                Error: {error}
              </p>
            )}
          </div>
        ) : (
          <CommandList 
            commands={filteredCommands} 
            hasError={!!error} 
            onNavigateToCommand={handleNavigateToCommand}
          />
        )}
      </div>
    </div>
  );
} 