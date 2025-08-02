"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import { Clock, FileText } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"
import { Command } from "@/app/agents/types"
import { getCommands } from "@/app/agents/actions"
import { CommandsTable } from "@/app/components/agents/commands-table"
import { CommandList } from "@/app/components/agents/command-list"
import { EmptyState } from "@/app/components/ui/empty-state"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"

// Maximum size of arrays to process, to prevent freezes
const MAX_ITEMS = 100;
const MAX_CONTEXT_LENGTH = 1000;
const MAX_DEPTH = 3;
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

const MAX_BASE64_IMAGE_LENGTH = 5000;

function truncateBase64Image(str: string): string {
  if (isBase64Image(str) && str.length > MAX_BASE64_IMAGE_LENGTH) {
    const prefix = str.startsWith('data:image') ? str.split(',')[0] + ',' : '';
    return prefix + '[Base64 image data truncated - ' + Math.round(str.length / 1024) + 'KB]';
  }
  return str;
}

function safeStringify(obj: any, maxDepth: number = MAX_DEPTH): string {
  const seen = new WeakSet();
  
  function replacer(key: string, value: any, depth: number = 0): any {
    if (depth > maxDepth) {
      return '[Max depth exceeded]';
    }
    
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string') {
      return truncateBase64Image(value.length > MAX_CONTEXT_LENGTH ? 
        value.substring(0, MAX_CONTEXT_LENGTH) + '...' : value);
    }
    
    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular reference]';
      }
      seen.add(value);
      
      if (Array.isArray(value)) {
        if (value.length > MAX_ITEMS) {
          return [...value.slice(0, MAX_ITEMS), `[... ${value.length - MAX_ITEMS} more items]`];
        }
        return value.map((item, index) => replacer(`${index}`, item, depth + 1));
      }
      
      const result: any = {};
      const keys = Object.keys(value);
      if (keys.length > MAX_ITEMS) {
        keys.slice(0, MAX_ITEMS).forEach(k => {
          result[k] = replacer(k, value[k], depth + 1);
        });
        result[`... ${keys.length - MAX_ITEMS} more properties`] = '[truncated]';
      } else {
        keys.forEach(k => {
          result[k] = replacer(k, value[k], depth + 1);
        });
      }
      return result;
    }
    
    return value;
  }
  
  try {
    const processed = replacer('', obj);
    return JSON.stringify(processed, null, 2);
  } catch (error) {
    console.error('Failed to stringify object:', error);
    return '[Failed to serialize object]';
  }
}

function safelyHandleError(error: any, fallbackMessage: string = "An error occurred"): string {
  try {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      if (error.message) {
        return String(error.message);
      }
      
      return safeStringify(error);
    }
    
    return fallbackMessage;
  } catch (e) {
    console.error('Error in safelyHandleError:', e);
    return fallbackMessage;
  }
}

interface CommandsViewProps {
  searchQuery?: string
}

export function CommandsView({ searchQuery = "" }: CommandsViewProps) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          setHasMore(result.commands.length === 40);
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
    
    const intervalId = setInterval(() => loadCommands(1, false), 60000);
    return () => clearInterval(intervalId);
  }, [currentSite?.id]);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands

    const query = searchQuery.toLowerCase().trim()
    return commands.filter(command => {
      const matchesTask = command.task?.toLowerCase().includes(query)
      const matchesDescription = command.description?.toLowerCase().includes(query)
      const matchesStatus = command.status?.toLowerCase().includes(query)
      const matchesContext = typeof command.context === 'string' && 
        command.context.toLowerCase().includes(query)
      
      return matchesTask || matchesDescription || matchesStatus || matchesContext
    })
  }, [commands, searchQuery]);
  


  

  

  
  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="commands-view">
      
      {/* Content */}
      <div className="p-8 space-y-4">
        <div className="px-8">
          <div className="space-y-4 min-h-[300px]">
            {loading && isInitialLoad ? (
              <div className="space-y-2" data-testid="loading-skeleton">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Card key={index} className="border border-border overflow-hidden">
                    <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
                      <div className="flex-1 p-4 w-full overflow-x-auto">
                        <div className="flex items-start gap-4 min-w-[1070px]">
                          {/* Task & Description */}
                          <div className="w-[400px] min-w-[400px] pr-2 flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              <Skeleton className="h-6 w-3/4" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                          </div>
                          {/* Agent */}
                          <div className="w-[150px] min-w-[150px] flex-shrink-0">
                            <Skeleton className="h-3 w-10 mb-1 mx-auto" />
                            <Skeleton className="h-4 w-24 mx-auto" />
                            <Skeleton className="h-3 w-16 mx-auto" />
                          </div>
                          
                          {/* Created Date */}
                          <div className="w-[180px] min-w-[180px] flex-shrink-0">
                            <Skeleton className="h-3 w-12 mb-1 mx-auto" />
                            <Skeleton className="h-4 w-20 mx-auto" />
                            <Skeleton className="h-3 w-16 mx-auto" />
                          </div>

                          {/* Duration */}
                          <div className="w-[100px] min-w-[100px] flex-shrink-0">
                            <Skeleton className="h-3 w-12 mb-1 mx-auto" />
                            <Skeleton className="h-4 w-16 mx-auto" />
                            <Skeleton className="h-3 w-14 mx-auto" />
                          </div>
                          {/* Status */}
                          <div className="w-[120px] min-w-[120px] flex-shrink-0">
                            <Skeleton className="h-3 w-12 mb-1 mx-auto" />
                            <Skeleton className="h-6 w-20 mx-auto" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredCommands.length === 0 ? (
              <div className="h-full flex items-center justify-center" data-testid="empty-state">
                <EmptyState
                  icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                  title="No commands found"
                  description={
                    error 
                      ? `Error: ${error}` 
                      : searchQuery.trim().length > 0
                        ? `No commands found matching "${searchQuery}". Try adjusting your search terms.`
                        : "There are no commands to display at this time."
                  }
                  variant="fancy"
                />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCommands.map((command) => (
                  <Card 
                    key={command.id} 
                    className="border border-border hover:border-foreground/20 transition-colors overflow-hidden cursor-pointer"
                    onClick={() => handleNavigateToCommand(command.id)}
                  >
                    <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
                      <div className="flex-1 p-4 w-full overflow-x-auto">
                        <div className="flex items-start gap-4 min-w-[1070px]">
                          {/* Command Task & Description */}
                          <div className="w-[400px] min-w-[400px] pr-2 flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg truncate">{command.task}</h3>
                            </div>
                            <p className="text-muted-foreground text-sm line-clamp-1">{command.description || 'No description available'}</p>
                          </div>
                          
                          {/* Agent */}
                          <div className="w-[150px] min-w-[150px] flex-shrink-0 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Agent</div>
                            <div className="text-sm font-medium truncate px-2">
                              {command.agent_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate px-2">
                              {command.agent_role || 'Unknown Role'}
                            </div>
                          </div>
                          
                          {/* Created Date */}
                          <div className="w-[180px] min-w-[180px] flex-shrink-0 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Created</div>
                            <div className="text-sm">
                              {command.created_at ? new Date(command.created_at).toLocaleDateString() : '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {command.created_at ? new Date(command.created_at).toLocaleTimeString() : '-'}
                            </div>
                          </div>
                          
                          {/* Duration */}
                          <div className="w-[100px] min-w-[100px] flex-shrink-0 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Duration</div>
                            <div className="text-sm font-medium">
                              {command.duration ? Math.round(command.duration / 1000) : '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {command.duration ? 'seconds' : ''}
                            </div>
                          </div>
                          
                          {/* Status */}
                          <div className="w-[120px] min-w-[120px] flex-shrink-0 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Status</div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              command.status === 'completed' ? "bg-green-100 text-green-800" :
                              command.status === 'running' ? "bg-blue-100 text-blue-800" :
                              command.status === 'pending' ? "bg-yellow-100 text-yellow-800" :
                              command.status === 'failed' ? "bg-red-100 text-red-800" :
                              command.status === 'cancelled' ? "bg-gray-100 text-gray-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {command.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            {hasMore && !loading && filteredCommands.length > 0 && (
              <div className="flex justify-center py-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full max-w-xs"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}