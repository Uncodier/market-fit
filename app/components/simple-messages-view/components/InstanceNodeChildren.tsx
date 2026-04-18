"use client"

import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { InstanceNode } from "@/app/types/instance-nodes"
import { Button } from "@/app/components/ui/button"
import { GitFork as GitBranch, Play, CheckCircle, AlertCircle, Clock } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useLayout } from "@/app/context/LayoutContext"

export function InstanceNodeChildren({
  parentLogId,
  instanceId,
  leading,
  toolbarRowClassName
}: {
  parentLogId: string
  instanceId: string
  /** Shown on the same row as Branch to Node (e.g. copy / feedback toolbar) */
  leading?: ReactNode
  /** e.g. hover-only: opacity + pointer-events, with group on parent */
  toolbarRowClassName?: string
}) {
  const [nodes, setNodes] = useState<InstanceNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { setRobotsViewMode } = useLayout()

  useEffect(() => {
    const fetchNodes = async () => {
      const { data } = await supabase
        .from('instance_nodes')
        .select('*')
        .eq('parent_instance_log_id', parentLogId)
      
      if (data) setNodes(data as InstanceNode[])
    }
    fetchNodes()

    const subscription = supabase
      .channel(`nodes_log_${parentLogId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_nodes',
        filter: `parent_instance_log_id=eq.${parentLogId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setNodes(prev => {
            if (prev.some(n => n.id === payload.new.id)) return prev;
            return [...prev, payload.new as InstanceNode];
          })
        } else if (payload.eventType === 'UPDATE') {
          setNodes(prev => prev.map(n => n.id === payload.new.id ? payload.new as InstanceNode : n))
        } else if (payload.eventType === 'DELETE') {
          setNodes(prev => prev.filter(n => n.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [parentLogId, supabase])

  const handleCreateNode = async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    
    // Get instance for site_id
    const { data: instance } = await supabase
      .from('remote_instances')
      .select('site_id')
      .eq('id', instanceId)
      .single()

    if (!session || !instance) {
      setIsLoading(false)
      return
    }

    const { error } = await supabase.from('instance_nodes').insert({
      instance_id: instanceId,
      site_id: instance.site_id,
      user_id: session.user.id,
      parent_instance_log_id: parentLogId,
      type: 'prompt',
      status: 'pending',
      prompt: { text: "Branched from chat" }
    })

    if (error) toast.error("Failed to branch node")
    else toast.success("Branched to node successfully")
    
    setIsLoading(false)
  }

  const navigateToImprenta = () => {
    setRobotsViewMode("imprenta")
    router.push(`/robots?instance=${instanceId}`)
  }

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <div
        className={cn(
          'flex w-full min-w-0 flex-row flex-wrap items-center gap-x-4 gap-y-2',
          toolbarRowClassName
        )}
      >
        {leading}
        <button
          type="button"
          onClick={handleCreateNode}
          disabled={isLoading}
          className={cn(
            'inline-flex w-fit min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/90 bg-background px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm',
            'transition-colors hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50',
            'dark:border-border dark:bg-card/80'
          )}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-foreground/85" />
          Branch to Node
        </button>
      </div>
      
      {nodes.length > 0 && (
        <div className="flex flex-col gap-1 mt-1 border-l-2 border-primary/20 pl-2">
          {nodes.map(node => (
            <div key={node.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-2xl text-xs border border-white/5">
              <div className="flex items-center gap-2">
                {node.status === 'completed' ? <CheckCircle className="w-3 h-3 text-green-500" /> :
                 node.status === 'failed' ? <AlertCircle className="w-3 h-3 text-red-500" /> :
                 node.status === 'running' ? <Play className="w-3 h-3 text-blue-500 animate-pulse" /> :
                 <Clock className="w-3 h-3 text-gray-400" />}
                <span className="font-medium">{node.type}</span>
                <span className="text-muted-foreground truncate max-w-[150px]">
                  {node.prompt?.text || 'Node'}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={navigateToImprenta}>
                Open in Content Creator
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
