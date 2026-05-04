"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { SearchInput } from "@/app/components/ui/search-input"
import { Play, X, Bot, Loader } from "@/app/components/ui/icons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface RobotInstance {
  id: string
  name?: string
  status?: string
  [key: string]: any
}

interface InstanceBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  instances: RobotInstance[]
  onSelect: (id: string) => void
  onDelete?: (instance: { id: string, name: string }) => void
  deletingInstanceIds?: Set<string>
}

export function InstanceBrowserModal({
  isOpen,
  onClose,
  instances,
  onSelect,
  onDelete,
  deletingInstanceIds
}: InstanceBrowserModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [instanceMessages, setInstanceMessages] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!isOpen || instances.length === 0) return

    const fetchMessages = async () => {
      const supabase = createClient()
      const instanceIds = instances.map(i => i.id)
      
      // Fetch latest log for each instance using chunking to avoid limits
      const chunkSize = 15
      const messagesByInstance: Record<string, any> = {}
      
      for (let i = 0; i < instanceIds.length; i += chunkSize) {
        const chunk = instanceIds.slice(i, i + chunkSize)
        const promises = chunk.map(async (id) => {
          const { data } = await supabase
            .from('instance_logs')
            .select('instance_id, message, created_at')
            .eq('instance_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            
          return data && data.length > 0 ? data[0] : null
        })
        
        const results = await Promise.all(promises)
        results.forEach(msg => {
          if (msg) {
            messagesByInstance[msg.instance_id] = msg
          }
        })
      }
      
      setInstanceMessages(messagesByInstance)
    }

    fetchMessages()
  }, [isOpen, instances])

  const filteredInstances = useMemo(() => {
    let result = instances

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = instances.filter(inst => {
        const displayName = inst.requirement_title ? inst.requirement_title : (inst.name || `mk-${inst.id.slice(-4)}`)
        const name = displayName.toLowerCase()
        return name.includes(query) || inst.id.toLowerCase().includes(query)
      })
    }

    return [...result].sort((a, b) => {
      const playStatuses = ['running', 'active', 'starting', 'pending', 'initializing'];
      const aIsPlay = playStatuses.includes(a.status) ? 1 : 0;
      const bIsPlay = playStatuses.includes(b.status) ? 1 : 0;
      
      if (aIsPlay !== bIsPlay) {
        return bIsPlay - aIsPlay;
      }
      
      const aTime = new Date((a.updated_at || a.created_at || 0)).getTime()
      const bTime = new Date((b.updated_at || b.created_at || 0)).getTime()
      return bTime - aTime
    })
  }, [instances, searchQuery])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden gap-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between sticky top-0 bg-background/50 z-10">
          <DialogTitle className="text-xl">Todas las Makinas</DialogTitle>
          <div className="flex items-center gap-4 flex-1 justify-end mr-8">
            <SearchInput
              value={searchQuery}
              onSearch={setSearchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar instancias..."
              className="w-64"
              alwaysExpanded={true}
            />
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          {filteredInstances.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre y Contexto</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead className="w-[140px]">Última Actualización</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstances.map((inst) => {
                    const isRunning = ['running', 'active'].includes(inst.status || '')
                    const isStarting = ['starting', 'pending', 'initializing'].includes(inst.status || '')
                    const displayName = inst.requirement_title ? inst.requirement_title : (inst.name || `mk-${inst.id.slice(-4)}`)
                    
                    // Extraer último mensaje
                    const lastMsg = instanceMessages[inst.id]
                    const lastMessage = lastMsg?.message || ""
                    
                    // Fechas formateadas
                    const updatedAt = inst.updated_at || inst.created_at || ""
                    const formattedDate = updatedAt 
                      ? new Date(updatedAt).toLocaleDateString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                        }) 
                      : "-"
                      
                    const lastMessageDate = lastMsg?.created_at 
                      ? new Date(lastMsg.created_at).toLocaleDateString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                        }) 
                      : "-"
                      
                    return (
                      <TableRow
                        key={inst.id}
                        onClick={() => {
                          onSelect(inst.id)
                          onClose()
                        }}
                        className={cn(
                          "cursor-pointer group transition-colors hover:bg-muted/50",
                          isRunning && "bg-green-500/5 hover:bg-green-500/10"
                        )}
                      >
                        <TableCell className="max-w-[400px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              {isRunning ? (
                                <Play className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : isStarting ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse flex-shrink-0 mx-0.5" />
                              ) : null}
                              <span className="font-medium truncate" title={displayName}>
                                {displayName}
                              </span>
                            </div>
                            
                            {lastMessage && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-80 overflow-hidden">
                                {lastMessageDate !== "-" && (
                                  <span className="whitespace-nowrap font-medium flex-shrink-0">
                                    {lastMessageDate}:
                                  </span>
                                )}
                                <span className="truncate" title={lastMessage}>
                                  {lastMessage}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {inst.status ? (
                            <span className="capitalize px-2 py-0.5 rounded-full bg-muted text-xs">
                              {inst.status}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>

                        <TableCell className="text-muted-foreground text-xs">
                          {formattedDate}
                        </TableCell>
                        
                        <TableCell>
                          {onDelete && (() => {
                            const isDeleting = deletingInstanceIds?.has(inst.id) ?? false
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isDeleting) return
                                  onDelete({ id: inst.id, name: displayName })
                                }}
                                disabled={isDeleting}
                                className={cn(
                                  "p-1.5 rounded-md transition-all flex items-center justify-center",
                                  isDeleting
                                    ? "opacity-100 text-destructive cursor-default"
                                    : "opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                )}
                                title={isDeleting ? "Eliminando..." : "Eliminar instancia"}
                              >
                                {isDeleting ? (
                                  <Loader className="h-4 w-4" size={16} />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            )
                          })()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <Bot className="h-12 w-12 opacity-20" />
              <p>No se encontraron instancias.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
