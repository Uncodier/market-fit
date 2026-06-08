"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { SearchInput } from "@/app/components/ui/search-input"
import { Play, X, Bot, Loader, CheckCircle2, Pause, MicroPause, MicroPlay, StopCircle, Clock, File, Image, FileVideo, FileText } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
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
  const [instanceStats, setInstanceStats] = useState<Record<string, { nodes: number, assets: number, requirements: number, recentAssets: any[], avatarUrl: string | null }>>({})
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  useEffect(() => {
    if (!isOpen || instances.length === 0) return

    let isMounted = true
    const supabase = createClient()
    const instanceIds = instances.map(i => i.id)
    const chunkSize = 15

    const fetchStats = async () => {
      setIsLoadingStats(true)
      
      for (let i = 0; i < instanceIds.length; i += chunkSize) {
        if (!isMounted) return
        const chunk = instanceIds.slice(i, i + chunkSize)
        const promises = chunk.map(async (id) => {
          const [nodesRes, assetsRes, recentAssetsRes, reqRes, latestImageRes] = await Promise.all([
            supabase.from('instance_nodes').select('id', { count: 'exact', head: true }).eq('instance_id', id),
            supabase.from('assets').select('id', { count: 'exact', head: true }).eq('instance_id', id),
            supabase.from('assets').select('id, file_path, name, file_type, created_at').eq('instance_id', id).order('created_at', { ascending: false }).limit(3),
            supabase.from('requirement_status').select('id', { count: 'exact', head: true }).eq('instance_id', id),
            supabase.from('assets').select('file_path').eq('instance_id', id).like('file_type', 'image/%').order('created_at', { ascending: false }).limit(1)
          ])
            
          let avatarUrl = null;
          if (latestImageRes.data && latestImageRes.data.length > 0) {
            const asset = latestImageRes.data[0];
            if (asset.file_path && asset.file_path.startsWith('http')) {
              avatarUrl = asset.file_path;
            } else if (asset.file_path) {
              let storagePath = asset.file_path;
              if (storagePath.includes('/')) {
                 const { data } = supabase.storage.from('assets').getPublicUrl(storagePath)
                 avatarUrl = data.publicUrl
              } else {
                const { data } = supabase.storage.from('assets').getPublicUrl(asset.file_path)
                avatarUrl = data.publicUrl
              }
            }
          }

          return {
            id,
            nodes: nodesRes.count || 0,
            assets: assetsRes.count || 0,
            recentAssets: recentAssetsRes.data || [],
            requirements: reqRes.count || 0,
            avatarUrl
          }
        })
        
        const results = await Promise.all(promises)
        if (!isMounted) return
        
        setInstanceStats(prev => {
          const newStats = { ...prev }
          results.forEach(res => {
            newStats[res.id] = {
              nodes: res.nodes,
              assets: res.assets,
              recentAssets: res.recentAssets,
              requirements: res.requirements,
              avatarUrl: res.avatarUrl
            }
          })
          return newStats
        })
      }
      if (isMounted) setIsLoadingStats(false)
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      
      for (let i = 0; i < instanceIds.length; i += chunkSize) {
        if (!isMounted) return
        const chunk = instanceIds.slice(i, i + chunkSize)
        const promises = chunk.map(async (id) => {
          const [userRes, agentRes] = await Promise.all([
            supabase
              .from('instance_logs')
              .select('message, details, created_at')
              .eq('instance_id', id)
              .eq('log_type', 'user_action')
              .order('created_at', { ascending: false })
              .limit(1),
            supabase
              .from('instance_logs')
              .select('message, details, created_at')
              .eq('instance_id', id)
              .in('log_type', ['agent_action', 'system'])
              .order('created_at', { ascending: false })
              .limit(1)
          ])
            
          return { 
            id, 
            user: userRes.data && userRes.data.length > 0 ? userRes.data[0] : null,
            agent: agentRes.data && agentRes.data.length > 0 ? agentRes.data[0] : null
          }
        })
        
        const results = await Promise.all(promises)
        if (!isMounted) return
        
        setInstanceMessages(prev => {
          const newMsgs = { ...prev }
          results.forEach(res => {
            newMsgs[res.id] = {
              user: res.user,
              agent: res.agent
            }
          })
          return newMsgs
        })
      }
      if (isMounted) setIsLoadingMessages(false)
    }

    // Ejecutar ambos de forma concurrente, actualizando progresivamente la UI
    fetchStats()
    fetchMessages()

    return () => {
      isMounted = false
    }
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
      const aIsPlay = playStatuses.includes(a.status || '') ? 1 : 0;
      const bIsPlay = playStatuses.includes(b.status || '') ? 1 : 0;
      
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
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-background/50 z-10 shrink-0">
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
                  <TableRow className="flex w-full items-center">
                    <TableHead className="w-[80px] flex-shrink-0 flex items-center justify-center"></TableHead>
                    <TableHead className="flex-1 flex items-center">Nombre y Contexto</TableHead>
                    <TableHead className="w-[60px] flex-shrink-0"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstances.map((inst) => {
                    const isRunning = ['running', 'active'].includes(inst.status || '')
                    const isStarting = ['starting', 'pending', 'initializing'].includes(inst.status || '')
                    let displayName = inst.requirement_title ? inst.requirement_title : (inst.name || `mk-${inst.id.slice(-4)}`)
                    
                    // Extraer últimos mensajes
                    const userMsg = instanceMessages[inst.id]?.user
                    const agentMsg = instanceMessages[inst.id]?.agent
                    
                    let userMessage = userMsg?.message || ""
                    if (userMsg?.details?.attachments && Array.isArray(userMsg.details.attachments) && userMsg.details.attachments.length > 0) {
                      const attachment = userMsg.details.attachments[0]
                      const name = attachment?.name || attachment?.file_name || attachment?.title
                      const attachmentName = name ? `: ${name}` : ""
                      const count = userMsg.details.attachments.length
                      const attachmentText = count > 1 ? `[${count} Archivos adjuntos]` : `[Archivo adjunto${attachmentName}]`
                      userMessage = userMessage ? `${userMessage} ${attachmentText}` : attachmentText
                    }
                    
                    let agentMessage = agentMsg?.message || ""
                    if (agentMsg?.details?.attachments && Array.isArray(agentMsg.details.attachments) && agentMsg.details.attachments.length > 0) {
                      const attachment = agentMsg.details.attachments[0]
                      const name = attachment?.name || attachment?.file_name || attachment?.title
                      const attachmentName = name ? `: ${name}` : ""
                      const count = agentMsg.details.attachments.length
                      const attachmentText = count > 1 ? `[${count} Archivos adjuntos]` : `[Archivo adjunto${attachmentName}]`
                      agentMessage = agentMessage ? `${agentMessage} ${attachmentText}` : attachmentText
                    }
                    
                    const userMsgDate = userMsg?.created_at 
                      ? new Date(userMsg.created_at).toLocaleDateString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                        }) 
                      : ""
                      
                    const agentMsgDate = agentMsg?.created_at 
                      ? new Date(agentMsg.created_at).toLocaleDateString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                        }) 
                      : ""

                    // Icono de estado (simplificado para que coincida con los tabs de robots/page.tsx)
                    const isPaused = inst.status === 'paused'
                    let StatusIconSmall: React.ReactNode = <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mx-0.5" />
                    let StatusIconLarge: React.ReactNode = <span className="w-4 h-4 rounded-full bg-gray-400" />
                    
                    if (isRunning) {
                      StatusIconSmall = <MicroPlay className="h-1.5 w-1.5 text-green-600 flex-shrink-0 mx-[1px]" />
                      StatusIconLarge = <Play className="h-6 w-6 text-green-600 flex-shrink-0" />
                    } else if (isPaused) {
                      StatusIconSmall = <MicroPause className="h-1.5 w-1.5 text-yellow-600 flex-shrink-0 mx-[1px]" />
                      StatusIconLarge = <Pause className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                    } else if (isStarting) {
                      StatusIconSmall = <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0 mx-0.5" />
                      StatusIconLarge = <span className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
                    }
                      
                    return (
                      <React.Fragment key={inst.id}>
                        <TableRow
                          onClick={() => {
                            onSelect(inst.id)
                            onClose()
                          }}
                          className={cn(
                            "cursor-pointer group transition-colors hover:bg-muted/50 border-b flex w-full",
                            isRunning && "bg-green-500/5 hover:bg-green-500/10"
                          )}
                        >
                          <TableCell className="w-[80px] flex-shrink-0 pl-4 py-4 pr-0 flex items-center justify-center">
                            {isLoadingStats && !instanceStats[inst.id] ? (
                              <Skeleton className="h-12 w-12 rounded-full" />
                            ) : instanceStats[inst.id]?.avatarUrl ? (
                              <div className="relative h-12 w-12 flex-shrink-0">
                                <img 
                                  src={instanceStats[inst.id].avatarUrl!} 
                                  alt="Instance avatar" 
                                  className="h-full w-full object-cover rounded-full bg-muted border border-border shadow-sm"
                                />
                                <div className="absolute bottom-0 right-0 bg-background rounded-full p-0.5 shadow-sm border border-border/10 flex items-center justify-center">
                                  {StatusIconSmall}
                                </div>
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-muted/20 border border-border/50 flex-shrink-0 shadow-sm relative">
                                {StatusIconLarge}
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell className="pl-4 py-4 pr-4 flex-1 flex flex-col gap-1.5 min-w-0 w-full">
                            <div className="flex items-center gap-2 flex-wrap w-full min-w-0">
                              <div className="flex items-center gap-2 max-w-full min-w-0">
                                <span className="font-medium truncate ml-1 block" title={displayName}>
                                  {displayName}
                                </span>
                              </div>

                              {/* Badges para Nodos, Assets y Status */}
                              {isLoadingStats && !instanceStats[inst.id] ? (
                                <Skeleton className="h-5 w-24 rounded-full bg-muted-foreground/20 ml-2" />
                              ) : (
                                <div className="flex items-center gap-1.5 ml-0 sm:ml-2 flex-shrink-0 flex-wrap">
                                  {(instanceStats[inst.id]?.nodes || 0) > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-muted-foreground/10">
                                      {instanceStats[inst.id].nodes} Nodos
                                    </span>
                                  )}
                                  
                                  {(instanceStats[inst.id]?.assets || 0) > 0 && (
                                    <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-muted-foreground/10">
                                      <span>{instanceStats[inst.id].assets} Assets</span>
                                      {instanceStats[inst.id]?.recentAssets && instanceStats[inst.id]?.recentAssets.length > 0 && (
                                        <div className="flex -space-x-1.5">
                                          {instanceStats[inst.id].recentAssets.map((asset, i) => {
                                            let content = null
                                            let imageUrl = null
                                            if (asset.file_type?.includes('image')) {
                                              if (asset.file_path && asset.file_path.startsWith('http')) {
                                                imageUrl = asset.file_path
                                              } else if (asset.file_path) {
                                                const supabase = createClient()
                                                let storagePath = asset.file_path;
                                                if (storagePath.includes('/')) {
                                                   const { data } = supabase.storage.from('assets').getPublicUrl(storagePath)
                                                   imageUrl = data.publicUrl
                                                } else {
                                                  const { data } = supabase.storage.from('assets').getPublicUrl(asset.file_path)
                                                  imageUrl = data.publicUrl
                                                }
                                              }
                                            }
                                            
                                            if (imageUrl) {
                                              content = (
                                                <img 
                                                  src={imageUrl} 
                                                  alt={asset.file_name || 'Asset image'} 
                                                  className="w-full h-full object-cover rounded-full"
                                                />
                                              )
                                            } else {
                                              let IconComponent = File
                                              if (asset.file_type?.includes('image')) IconComponent = Image
                                              else if (asset.file_type?.includes('video')) IconComponent = FileVideo
                                              else if (asset.file_type?.includes('text') || asset.file_type?.includes('pdf') || asset.file_type?.includes('doc')) IconComponent = FileText

                                              content = <IconComponent className="h-2 w-2 text-muted-foreground" />
                                            }

                                            return (
                                              <div 
                                                key={asset.id || i} 
                                                className="h-4 w-4 rounded-full border border-background bg-muted-foreground/10 flex items-center justify-center relative z-10 overflow-hidden"
                                                style={{ zIndex: 10 - i }}
                                                title={asset.file_name}
                                              >
                                                {content}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(instanceStats[inst.id]?.requirements || 0) > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-muted-foreground/10">
                                      {instanceStats[inst.id].requirements} Status
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="mt-1 w-full">
                                  {isLoadingMessages && !instanceMessages[inst.id] ? (
                                    <div className="flex flex-col gap-2 pl-[22px] w-full">
                                      <Skeleton className="h-3 w-3/4 rounded-sm bg-muted-foreground/10" />
                                      <Skeleton className="h-3 w-5/6 rounded-sm bg-muted-foreground/10" />
                                    </div>
                                  ) : (userMessage || agentMessage) ? (
                                    <div className="flex flex-col gap-1.5 pl-6">
                                      {userMessage && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-90 overflow-hidden">
                                          <div className="h-4 w-4 rounded-sm bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 text-[9px] font-bold">
                                            U
                                          </div>
                                          <span className="truncate" title={userMessage}>
                                            {userMessage}
                                          </span>
                                        </div>
                                      )}
                                      {agentMessage && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-90 overflow-hidden">
                                          <div className="h-4 w-4 rounded-sm bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-[9px] font-bold">
                                            A
                                          </div>
                                          <span className="truncate" title={agentMessage}>
                                            {agentMessage}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                ) : (
                                  <div className="flex flex-col pl-[24px]">
                                    <span className="text-[11px] text-muted-foreground/50">Sin mensajes recientes</span>
                                  </div>
                                )}
                                </div>
                          </TableCell>
                          
                          <TableCell className="w-[60px] flex flex-shrink-0 items-start justify-end p-4">
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
                      </React.Fragment>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
