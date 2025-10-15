"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { CheckCircle2, AlertCircle, Clock, FileText, RotateCcw, PlayCircle } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { InstanceLog } from "@/app/agents/actions"
import { getInstanceLogs } from "@/app/agents/actions"
import { AgentToolsTable } from "@/app/components/agents/agent-tools-table"
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

// Cache for sanitized logs to prevent re-processing
const sanitizedLogsCache = new Map<string, InstanceLog>();

// Helper to sanitize potentially problematic logs
function sanitizeLog(log: InstanceLog): InstanceLog {
  if (!log) return log;
  
  // Return from cache if available
  if (log.id && sanitizedLogsCache.has(log.id)) {
    return sanitizedLogsCache.get(log.id)!;
  }
  
  try {
    // Create a safe copy to avoid modifying the original
    const sanitized = { ...log };
    
    // Check for extremely large message fields that might be JSON containing base64 images
    if (sanitized.message && typeof sanitized.message === 'string') {
      // If the message is very large and might contain a base64 image
      if (sanitized.message.length > 1000 && sanitized.message.includes('data:image')) {
        sanitized.message = "[Base64 image in message removed]";
      } else if (sanitized.message.length > MAX_CONTEXT_LENGTH) {
        // Regular message truncation for non-image content
        sanitized.message = sanitized.message.substring(0, MAX_CONTEXT_LENGTH) + "... (truncated)";
      }
    }
    
    // For details, tool_result, tool_args, and artifacts, only keep essential info
    if (sanitized.details) {
      sanitized.details = processSafeObject(sanitized.details);
    }
    
    if (sanitized.tool_result) {
      sanitized.tool_result = processSafeObject(sanitized.tool_result);
    }
    
    if (sanitized.tool_args) {
      sanitized.tool_args = processSafeObject(sanitized.tool_args);
    }
    
    if (sanitized.artifacts) {
      sanitized.artifacts = processSafeObject(sanitized.artifacts);
    }
    
    // Store in cache for reuse
    if (sanitized.id) {
      sanitizedLogsCache.set(sanitized.id, sanitized);
    }
    
    return sanitized;
  } catch (err) {
    console.error("Failed to sanitize log:", err);
    // Return a minimal safe version if sanitization fails
    return {
      id: log.id || "unknown-id",
      log_type: log.log_type || "system",
      level: log.level || "info",
      message: log.message || "Error processing log",
      created_at: log.created_at || new Date().toISOString()
    };
  }
}

// Clear cache when number of items gets too large to prevent memory leaks
function clearCacheIfNeeded() {
  if (sanitizedLogsCache.size > 100) {
    console.log("Clearing sanitized logs cache");
    sanitizedLogsCache.clear();
  }
}

// Sanitize an array of logs
function sanitizeLogs(logs: InstanceLog[]): InstanceLog[] {
  if (!logs || !Array.isArray(logs)) return [];
  
  // Limit number of logs to prevent freezing
  const limitedLogs = logs.slice(0, MAX_ITEMS);
  
  // Safe mapping that won't crash if a single log fails
  const result: InstanceLog[] = [];
  for (const log of limitedLogs) {
    try {
      if (log) {
        // Ensure all required fields have valid values to prevent UI errors
        result.push({
          ...log,
          id: log.id || `unknown-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          log_type: log.log_type || "system",
          level: log.level || "info",
          message: log.message || "Unknown message",
          created_at: log.created_at || new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Error sanitizing log:", err);
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

export function AgentToolsPanel() {
  const [logs, setLogs] = useState<InstanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const { currentSite } = useSite();
  
  // Handle navigation to log detail page
  const handleNavigateToLog = useCallback((logId: string) => {
    try {
      // Navigate to log detail route
      router.push(`/agents/tools/${logId}`);
    } catch (err) {
      console.error("Error navigating to log detail:", err);
    }
  }, [router]);
  
  // Function to load logs
  const loadLogs = async (page: number = 1, append: boolean = false) => {
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

      const result = await getInstanceLogs(currentSite.id, page);

      if (result.error) {
        console.error("Error:", result.error);
        setError(result.error);
        if (!isInitialLoad) {
          toast.error("Error loading logs.");
        }
      } else {
        if (result.logs && result.logs.length > 0) {
          setLogs(prev => append ? [...prev, ...result.logs!] : result.logs!);
          setHasMore(result.logs.length === 40); // If we got less than 40 items, we've reached the end
          setError(null);
        } else {
          if (!append) {
            setLogs([]);
          }
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error loading logs:", err);
      setError("Failed to load logs");
      if (!isInitialLoad) {
        toast.error("Error loading logs.");
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  // Load more logs
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await loadLogs(nextPage, true);
  };
  
  // Load logs when component mounts or currentSite changes
  useEffect(() => {
    setCurrentPage(1);
    loadLogs(1, false);
    
    // Set up polling for real-time updates with a higher interval to reduce load
    const intervalId = setInterval(() => loadLogs(1, false), 60000); // Update every minute
    
    // Clear interval when unmounting
    return () => clearInterval(intervalId);
  }, [currentSite?.id]);
  
  // Memoized logs list
  const filteredLogs = useMemo(() => {
    try {
      if (!logs || !Array.isArray(logs) || logs.length === 0) {
        return [];
      }
      return sanitizeLogs(logs);
    } catch (err) {
      console.error("Critical error in log mapping:", err);
      return [];
    }
  }, [logs]);
  
  return (
    <div className="flex flex-col" data-testid="agent-tools-panel">
      <div className="flex-1 p-0">
        <div className="p-8 space-y-4">
          <div className="px-8">
            {loading && logs.length === 0 ? (
              <Card className="overflow-hidden" data-testid="loading-state">
                <div className="relative w-full">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]"><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead className="w-[140px] min-w-[140px] max-w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                        <TableHead className="w-[130px] min-w-[130px] max-w-[130px]"><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead className="w-[140px] min-w-[140px] max-w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
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
                            <Skeleton className="h-4 w-20" />
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
            ) : filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4" data-testid="empty-state">
                <EmptyCard
                  icon={<FileText className="h-10 w-10 text-muted-foreground" />}
                  title={"No logs found"}
                  description={error ? `Error: ${error}` : "There are no logs to display at this time."}
                  showShadow={false}
                />
              </div>
            ) : (
              <AgentToolsTable
                logs={filteredLogs}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                isLoading={isLoadingMore}
                onRowClick={(log) => {
                  if (!log?.id) return;
                  handleNavigateToLog(log.id);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


