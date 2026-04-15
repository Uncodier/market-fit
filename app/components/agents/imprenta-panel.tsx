"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { createClient } from "@/lib/supabase/client"
import { ZoomableCanvas } from "./zoomable-canvas"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Plus, Play, RotateCcw as RefreshCw, AlertCircle, FileText, Bot, Eye, Trash2, GitFork, Link, Copy, Globe, Mail, Phone, UploadCloud } from "@/app/components/ui/icons"
import { SocialIcon } from "@/app/components/ui/social-icons"
import { InstanceNode } from "@/app/types/instance-nodes"
import { toast } from "sonner"
import { uploadAssetFile } from "@/app/assets/actions"
import { AnimatedConnectionLine } from "./animated-connection-line"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Textarea } from "@/app/components/ui/textarea"
import { MediaParametersToolbar } from "../simple-messages-view/components/MediaParametersToolbar"
import { ImageParameters, VideoParameters, AudioParameters } from "../simple-messages-view/types"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from '../simple-messages-view/utils/markdownComponents'

export function ImprentaPanel({ activeInstanceId }: { activeInstanceId?: string }) {
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const sidebarWidth = isMobile ? 0 : isLayoutCollapsed ? 64 : 256;
  
  const supabase = createClient()
  const [nodes, setNodes] = useState<InstanceNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState("")
  const isCreatingRootRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dummyNodes, setDummyNodes] = useState<InstanceNode[]>([])

  const [positions, setPositions] = useState<Record<string, {x: number, y: number}>>({})
  const [contexts, setContexts] = useState<any[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  
  const [tempConnection, setTempConnection] = useState<{fromNode: string, currentX: number, currentY: number} | null>(null)
  const drawingConnectionRef = useRef<{fromNode: string, mouseStartX: number, mouseStartY: number, nodeStartX: number, nodeStartY: number} | null>(null)

  const draggingNodeRef = useRef<string | null>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dragStartNodePos = useRef({ x: 0, y: 0 })
  const positionsRef = useRef<Record<string, {x: number, y: number}>>({})
  const nodesRef = useRef<InstanceNode[]>([])
  
  const nodeHeightsRef = useRef<Record<string, number>>({})
  const nodeElementsRef = useRef<Record<string, HTMLDivElement>>({})
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const registerNodeRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeElementsRef.current[nodeId] = el
      resizeObserverRef.current?.observe(el)
    } else {
      const prev = nodeElementsRef.current[nodeId]
      if (prev) resizeObserverRef.current?.unobserve(prev)
      delete nodeElementsRef.current[nodeId]
    }
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const el = entry.target as HTMLDivElement
        const nodeId = el.dataset.nodeId
        if (!nodeId) continue
        const h = Math.ceil(entry.contentRect.height)
        if (nodeHeightsRef.current[nodeId] !== h) {
          nodeHeightsRef.current[nodeId] = h
          changed = true
        }
      }
      if (changed) {
        setPositions(prev => getLayoutPositions(nodesRef.current, prev, nodeHeightsRef.current))
      }
    })
    resizeObserverRef.current = ro
    return () => ro.disconnect()
  }, [])

  // Keep refs in sync for window event listeners
  useEffect(() => { positionsRef.current = positions }, [positions])
  useEffect(() => { nodesRef.current = [...nodes, ...dummyNodes] }, [nodes, dummyNodes])

  // Reset initial prompt when changing instances
  useEffect(() => {
    setInitialPrompt("")
  }, [activeInstanceId])

  // Media parameters state
  const [selectedMediaType, setSelectedMediaType] = useState<'text' | 'image' | 'video' | 'audio' | 'audience' | 'publish'>('text')
  const [textParams, setTextParams] = useState<any>({ expectedResults: 1, length: 'medium', styles: ['default'] })
  const [imageParams, setImageParams] = useState<ImageParameters>({ format: 'PNG', aspectRatio: '1:1', quality: 100, expectedResults: 1 })
  const [videoParams, setVideoParams] = useState<VideoParameters>({ aspectRatio: '16:9', resolution: '1080p', duration: 4, expectedResults: 1 })
  const [audioParams, setAudioParams] = useState<AudioParameters>({ format: 'MP3', sampleRate: '44.1kHz', channels: 'stereo', expectedResults: 1 })

  // Fetch nodes for the selected instance
  useEffect(() => {
    if (!activeInstanceId) return
    
    const fetchNodes = async () => {
      setIsLoading(true)
      
      const { data, error } = await supabase
        .from('instance_nodes')
        .select('*')
        .eq('instance_id', activeInstanceId)
      
      if (!error && data) {
        if (data.length === 0) {
          // Auto-create an empty root node to avoid jumping UI
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData?.session && !isCreatingRootRef.current) {
            isCreatingRootRef.current = true
            try {
              const newNode = {
                instance_id: activeInstanceId,
                site_id: currentSite?.id,
                user_id: sessionData.session.user.id,
                parent_node_id: null,
                type: 'prompt',
                status: 'pending',
                prompt: { text: '' },
                settings: {},
                result: {}
              }
              const { data: newDbNode } = await supabase.from('instance_nodes').insert(newNode).select('*').single()
              if (newDbNode) {
                setNodes(prev => {
                  if (prev.some(n => n.id === newDbNode.id)) return prev;
                  return [...prev, newDbNode as InstanceNode];
                })
              }
            } finally {
              // We don't reset it immediately to prevent strict-mode double-fetches
              // but we reset it after a delay so it can be re-used if needed
              setTimeout(() => {
                isCreatingRootRef.current = false
              }, 1000)
            }
          }
        } else {
          setNodes(data as InstanceNode[])
          const nodeIds = data.map((n: any) => n.id)
          if (nodeIds.length > 0) {
            const { data: ctxData } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', nodeIds)
            if (ctxData) setContexts(ctxData)
          }
        }
      }
      setIsLoading(false)
    }
    
    fetchNodes()

    // Subscribe to realtime updates for nodes
    const subscription = supabase
      .channel(`instance_nodes_${activeInstanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_nodes',
        filter: `instance_id=eq.${activeInstanceId}`
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setNodes(prev => {
            if (prev.some(n => n.id === payload.new.id)) return prev;
            return [...prev, payload.new as InstanceNode];
          })
          setDummyNodes(prev => {
            // Find dummies for the same parent
            const dummiesForParent = prev.filter(d => d.parent_node_id === payload.new.parent_node_id);
            
            if (dummiesForParent.length > 0) {
              // Get the first dummy that hasn't been replaced yet
              const dummyToReplace = dummiesForParent[0];
              const index = prev.findIndex(d => d.id === dummyToReplace.id);
              
              if (index !== -1) {
                // Pre-assign the dummy's position and height to the new real node
                setPositions(currPositions => {
                  if (currPositions[dummyToReplace.id]) {
                    const newPositions = {
                      ...currPositions,
                      [payload.new.id]: currPositions[dummyToReplace.id]
                    };
                    
                    if (nodeHeightsRef.current[dummyToReplace.id]) {
                      nodeHeightsRef.current[payload.new.id] = nodeHeightsRef.current[dummyToReplace.id];
                    }
                    
                    // Immediately clean up the dummy node's position so it doesn't bump the new node
                    delete (newPositions as any)[dummyToReplace.id];
                    
                    return newPositions;
                  }
                  return currPositions;
                });
                
                const copy = [...prev];
                copy.splice(index, 1);
                return copy;
              }
            }
            return prev;
          })
        } else if (payload.eventType === 'UPDATE') {
          setNodes(prev => prev.map(n => n.id === payload.new.id ? payload.new as InstanceNode : n))
          // If the executed node fails or completes without a child, we might want to clear dummy children
          if (payload.new.status === 'failed' || payload.new.status === 'completed') {
            setDummyNodes(prev => {
              const toRemove = prev.filter(d => d.parent_node_id === payload.new.id);
              if (toRemove.length > 0) {
                // Also clean up their positions to prevent memory leaks
                setPositions(curr => {
                  const copy = { ...curr };
                  toRemove.forEach(d => delete copy[d.id]);
                  return copy;
                });
                return prev.filter(d => d.parent_node_id !== payload.new.id);
              }
              return prev;
            });
          }
        } else if (payload.eventType === 'DELETE') {
          setNodes(prev => prev.filter(n => n.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to realtime updates for contexts
    const contextSubscription = supabase
      .channel(`instance_node_contexts_${activeInstanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_node_contexts'
      }, async () => {
        // Refetch contexts on any change
        const currentNodes = nodesRef.current.map(n => n.id)
        if (currentNodes.length > 0) {
          const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes)
          if (data) setContexts(data)
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
      contextSubscription.unsubscribe()
    }
  }, [activeInstanceId, supabase, currentSite])

  const handleExecuteNode = async (node: InstanceNode) => {
    toast.info("Executing node...")
    try {
      // Create a dummy placeholder child node visually
      const expectedAmount = Number((node.settings as any)?.parameters?.expectedResults) || 1;
      const newDummies = Array.from({ length: expectedAmount }).map((_, i) => ({
        id: `dummy-${Date.now()}-${i}`,
        instance_id: node.instance_id,
        parent_node_id: node.id,
        original_node_id: null,
        parent_instance_log_id: null,
        type: 'Generating...',
        status: 'running',
        prompt: { text: '' },
        settings: {},
        result: {},
        site_id: node.site_id,
        user_id: node.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as InstanceNode));
      
      setDummyNodes(prev => [...prev, ...newDummies])

      // 1. Set the current node to running to show visual feedback immediately
      await supabase
        .from('instance_nodes')
        .update({ status: 'running' })
        .eq('id', node.id)

      const { apiClient } = await import('@/app/services/api-client-service')
      const { getSystemPromptForActivity } = await import('@/app/components/simple-messages-view/utils')
      
      // Prepare context string with media parameters
      const contextObj: any = {
        mediaType: (node.settings as any)?.media_type || (node.type === 'prompt' ? 'text' : node.type.replace('generate-', '')),
        parameters: { ...((node.settings as any)?.parameters || {}) }
      };

      // Remove expectedResults from context to prevent the LLM from duplicating output internally
      if (contextObj.parameters.expectedResults !== undefined) {
        delete contextObj.parameters.expectedResults;
      }
      
      const systemPrompt = getSystemPromptForActivity(node.type, {
        imageParameters: (node.settings as any)?.parameters,
        videoParameters: (node.settings as any)?.parameters,
        audioParameters: (node.settings as any)?.parameters,
      });

      const requestPayload = {
        message: node.prompt?.text || "Execute node",
        site_id: node.site_id,
        user_id: node.user_id,
        instance_id: node.instance_id,
        instance_node_id: node.id, // Pass the current node ID instead of creating a child
        context: JSON.stringify(contextObj),
        system_prompt: systemPrompt,
        expected_results_amount: (node.settings as any)?.parameters?.expectedResults || 1
      }
      
      const response = await apiClient.post('/api/robots/instance/assistant', requestPayload)
      
      if (!response.success) {
        console.error('API Error Response:', response.error);
        
        // Revert node status on failure
        await supabase
          .from('instance_nodes')
          .update({ status: 'failed' })
          .eq('id', node.id)
          
        throw new Error(`Failed to start execution: ${response.error?.message || 'Unknown error'}`);
      }
      
      toast.success("Execution started asynchronously")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to execute node")
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    // Keep a backup in case the deletion fails
    const previousNodes = [...nodes];
    
    // Optimistic update to remove it from UI immediately
    setNodes(prev => prev.filter(n => n.id !== nodeId))

    try {
      const { error } = await supabase
        .from('instance_nodes')
        .delete()
        .eq('id', nodeId)
      
      if (error) throw error
      
      // Delete associated asset file if it was an imprenta uploaded file
      if (nodeToDelete && (nodeToDelete.settings as any)?.imprenta_mode) {
        const url = (nodeToDelete.result as any)?.outputs?.[0]?.url;
        if (url) {
          const urlParts = url.split('/');
          const storagePath = urlParts[urlParts.length - 2] + '/' + urlParts[urlParts.length - 1];
          supabase.storage.from('assets').remove([storagePath]).catch(err => {
            console.error("Failed to delete storage asset:", err);
          });
        }
      }

      toast.success("Node deleted")
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete node. It might have children.")
      // Restore on failure (since there might be foreign key restrictions)
      setNodes(previousNodes)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeInstanceId || !currentSite) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setIsUploadingAsset(true)
    toast.info("Uploading asset...")

    try {
      const { path, error: uploadError } = await uploadAssetFile(file)
      if (uploadError || !path) {
        throw new Error(uploadError || "Error uploading file")
      }

      // Determine media type
      let mediaType = 'text'
      if (file.type.startsWith('image/')) mediaType = 'image'
      else if (file.type.startsWith('video/')) mediaType = 'video'
      else if (file.type.startsWith('audio/')) mediaType = 'audio'

      const newNode = {
        instance_id: activeInstanceId,
        site_id: currentSite.id,
        user_id: session.user.id,
        parent_node_id: null,
        type: `generate-${mediaType}`,
        status: 'completed',
        prompt: { text: file.name },
        settings: { 
          imprenta_mode: true, 
          media_type: mediaType 
        },
        result: {
          outputs: [{ url: path, type: mediaType }]
        }
      }

      const { error } = await supabase.from('instance_nodes').insert(newNode)
      
      if (error) {
        throw error
      }
      
      toast.success("Asset uploaded successfully")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to upload asset")
    } finally {
      setIsUploadingAsset(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleCreateChild = async (parentId: string | null = null, promptText: string = "New node prompt") => {
    if (!activeInstanceId || !currentSite) return
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    
    // Pass media type and params into settings
    const nodeSettings = selectedMediaType === 'text' 
      ? { media_type: 'text', parameters: textParams } 
      : {
          media_type: selectedMediaType,
          parameters: selectedMediaType === 'image' ? imageParams :
                      selectedMediaType === 'video' ? videoParams :
                      selectedMediaType === 'audio' ? audioParams : {}
        };
    
    const newNode = {
      instance_id: activeInstanceId,
      site_id: currentSite.id,
      user_id: session.user.id,
      parent_node_id: parentId,
      type: selectedMediaType === 'text' ? 'prompt' : selectedMediaType === 'publish' ? 'publish' : `generate-${selectedMediaType}`,
      status: 'pending',
      prompt: { text: promptText },
      settings: nodeSettings,
      result: {}
    }
    
    const { data, error } = await supabase.from('instance_nodes').insert(newNode).select('id').single()
    if (error) {
      toast.error("Failed to create node")
      console.error(error)
      return null
    } else {
      toast.success("Node created")
      return data.id
    }
  }

  const handleCreateActionFromContext = async (contextNodeId: string) => {
    if (!activeInstanceId || !currentSite) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // 1. Create action node
    const newNode = {
      instance_id: activeInstanceId,
      site_id: currentSite.id,
      user_id: session.user.id,
      parent_node_id: contextNodeId, // visual parent
      type: 'prompt',
      status: 'pending',
      prompt: { text: '' },
      settings: {},
      result: {}
    }
    
    const { data: actionNode, error } = await supabase.from('instance_nodes').insert(newNode).select('id').single()
    if (error || !actionNode) {
      toast.error("Failed to create action node")
      return
    }

    // 2. Link context
    const contextLink = {
      target_node_id: actionNode.id,
      context_node_id: contextNodeId,
      site_id: currentSite.id,
      user_id: session.user.id
      // 'type' could be specified here if we had a prompt for it, leaving null for now
    }
    await supabase.from('instance_node_contexts').insert(contextLink)
    
    toast.success("Action node created with context")
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return // Only left click
    const target = e.target as HTMLElement
    // Prevent dragging if clicking on an input/button
    if (target.closest('button') || target.closest('textarea') || target.closest('input')) return
    
    e.stopPropagation()
    e.preventDefault() // Prevents native image drag and text selection which breaks mousemove
    
    draggingNodeRef.current = nodeId
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    dragStartNodePos.current = { 
      x: positionsRef.current[nodeId]?.x || 0, 
      y: positionsRef.current[nodeId]?.y || 0 
    }
    
    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
  }

  const handleWindowMouseMove = (e: MouseEvent) => {
    const nodeId = draggingNodeRef.current
    if (!nodeId) return
    
    let scale = 1
    const contentDiv = document.getElementById('imprenta-canvas-content')
    if (contentDiv && contentDiv.parentElement) {
       const transform = contentDiv.parentElement.style.transform
       const match = transform.match(/scale\(([^)]+)\)/)
       if (match) scale = parseFloat(match[1]) || 1
    }

    const dx = (e.clientX - dragStartPos.current.x) / scale
    const dy = (e.clientY - dragStartPos.current.y) / scale
    
    setPositions(prev => ({
      ...prev,
      [nodeId]: {
        x: dragStartNodePos.current.x + dx,
        y: dragStartNodePos.current.y + dy
      }
    }))
  }

  const handleWindowMouseUp = async () => {
    const nodeId = draggingNodeRef.current
    if (nodeId) {
       const nodeToUpdate = nodesRef.current.find(n => n.id === nodeId)
       const newPos = positionsRef.current[nodeId]
       if (nodeToUpdate && newPos) {
          const updatedSettings = { ...((nodeToUpdate.settings as any) || {}), ui_position: newPos }
          await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', nodeId)
       }
    }
    draggingNodeRef.current = null
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
  }

  const handleConnectionStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    let scale = 1;
    const contentDiv = document.getElementById('imprenta-canvas-content');
    if (contentDiv && contentDiv.parentElement) {
       const transform = contentDiv.parentElement.style.transform;
       const match = transform.match(/scale\(([^)]+)\)/);
       if (match) scale = parseFloat(match[1]) || 1;
    }
    
    const startPos = positionsRef.current[nodeId] || {x: 0, y: 0};
    const startX = startPos.x + NODE_W;
    const startY = startPos.y + (nodeHeightsRef.current[nodeId] || ROW_H) / 2;

    drawingConnectionRef.current = {
       fromNode: nodeId,
       mouseStartX: e.clientX,
       mouseStartY: e.clientY,
       nodeStartX: startX,
       nodeStartY: startY
    };
    
    setTempConnection({
      fromNode: nodeId,
      currentX: startX,
      currentY: startY
    });
    
    window.addEventListener('mousemove', handleConnectionMove);
    window.addEventListener('mouseup', handleConnectionEnd);
  }

  const handleConnectionMove = (e: MouseEvent) => {
    if (!drawingConnectionRef.current) return;
    
    let scale = 1;
    const contentDiv = document.getElementById('imprenta-canvas-content');
    if (contentDiv && contentDiv.parentElement) {
       const transform = contentDiv.parentElement.style.transform;
       const match = transform.match(/scale\(([^)]+)\)/);
       if (match) scale = parseFloat(match[1]) || 1;
    }
    
    const dx = (e.clientX - drawingConnectionRef.current.mouseStartX) / scale;
    const dy = (e.clientY - drawingConnectionRef.current.mouseStartY) / scale;
    
    setTempConnection({
      fromNode: drawingConnectionRef.current.fromNode,
      currentX: drawingConnectionRef.current.nodeStartX + dx,
      currentY: drawingConnectionRef.current.nodeStartY + dy
    });
  }

  const handleConnectionEnd = () => {
    drawingConnectionRef.current = null;
    setTempConnection(null);
    window.removeEventListener('mousemove', handleConnectionMove);
    window.removeEventListener('mouseup', handleConnectionEnd);
  }

  const handleConnectionDrop = async (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (drawingConnectionRef.current) {
      const sourceNodeId = drawingConnectionRef.current.fromNode;
      if (sourceNodeId !== targetNodeId) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session && currentSite) {
          const { error } = await supabase.from('instance_node_contexts').insert({
            target_node_id: targetNodeId,
            context_node_id: sourceNodeId,
            site_id: currentSite.id,
            user_id: session.user.id
          });
          
          if (error) {
            if (error.code === '23505') toast.error("Context already linked");
            else toast.error("Failed to link context");
          } else {
            toast.success("Context linked!");
            const currentNodes = nodesRef.current.map(n => n.id);
            const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes);
            if (data) setContexts(data);
          }
        }
      }
    }
  }

  const handleDeleteContext = async (contextId: string) => {
    try {
      const { error } = await supabase
        .from('instance_node_contexts')
        .delete()
        .eq('id', contextId);
      
      if (error) throw error;
      
      toast.success("Connection deleted");
      setContexts(prev => prev.filter(c => c.id !== contextId));
      if (selectedContextId === contextId) {
        setSelectedContextId(null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete connection");
    }
  }

  const handleUpdateContextType = async (contextId: string, type: string) => {
    try {
      const { error } = await supabase
        .from('instance_node_contexts')
        .update({ type })
        .eq('id', contextId);
        
      if (error) throw error;
      
      setContexts(prev => prev.map(c => c.id === contextId ? { ...c, type } : c));
      toast.success("Connection type updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update connection type");
    }
  }

  const NODE_W = 480
  const H_GAP = 80
  const V_GAP = 40
  const ROW_H = 300
  const PAD_X = 100 + sidebarWidth
  const PAD_Y = 100 + 188

  const getLayoutPositions = (
    currentNodes: InstanceNode[],
    currentPositions: Record<string, { x: number; y: number }>,
    heights: Record<string, number> = nodeHeightsRef.current
  ): Record<string, { x: number; y: number }> => {
    const pos = { ...currentPositions }
    
    // Clean up any stale dummy positions first before we start logic, so we don't treat them as fixed nodes
    const validIds = new Set(currentNodes.map(n => n.id))
    Object.keys(pos).forEach(id => {
      if (!validIds.has(id)) {
        delete pos[id]
      }
    })
    
    // Group nodes by parent, preserving current visual order of positioned nodes
    const parentGroups: Record<string, InstanceNode[]> = {}
    currentNodes.forEach(n => {
      const pId = n.parent_node_id || '__root__'
      if (!parentGroups[pId]) parentGroups[pId] = []
      parentGroups[pId].push(n)
    })
    
      // Sort siblings: those with established positions stay in relative Y order,
      // unpositioned ones go at the end
      Object.keys(parentGroups).forEach(pId => {
        parentGroups[pId].sort((a, b) => {
          const pa = pos[a.id]
          const pb = pos[b.id]
          
          if (pa && pb) return pa.y - pb.y
          if (pa) return -1
          if (pb) return 1
          
          // Determine timestamp, fallback to 0
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          
          // For unpositioned ones, dummies last (stable sort) 
          // So if we have real nodes and dummies generated at the same time, real nodes show up first
          const isDummyA = a.id.startsWith('dummy-');
          const isDummyB = b.id.startsWith('dummy-');
          
          if (!isDummyA && isDummyB) return -1;
          if (isDummyA && !isDummyB) return 1;
          
          return timeA - timeB;
        })
      })

    const isInitial = !currentNodes.some(n => pos[n.id] && !n.id.startsWith('dummy-'))

    const nodeDepth = (id: string): number => {
      const n = currentNodes.find(nd => nd.id === id)
      if (!n?.parent_node_id) return 0
      return 1 + nodeDepth(n.parent_node_id)
    }

    const h = (id: string) => (heights[id] || ROW_H) + V_GAP

    if (isInitial && currentNodes.length > 0) {
      const subtreeHeight = (id: string): number => {
        const ch = parentGroups[id] || []
        if (ch.length === 0) return h(id)
        const childrenSum = ch.reduce((s, c) => s + subtreeHeight(c.id), 0)
        return Math.max(h(id), childrenSum)
      }

      const assign = (id: string, d: number, yStart: number) => {
        const ch = parentGroups[id] || []
        const totalH = subtreeHeight(id)
        pos[id] = {
          x: PAD_X + d * (NODE_W + H_GAP),
          y: yStart + (totalH - h(id)) / 2
        }
        let cy = yStart
        ch.forEach(c => {
          assign(c.id, d + 1, cy)
          cy += subtreeHeight(c.id)
        })
      }

      const roots = parentGroups['__root__'] || []
      let yOffset = PAD_Y
      roots.forEach(r => {
        assign(r.id, 0, yOffset)
        yOffset += subtreeHeight(r.id) + V_GAP
      })
    } else {
      const unpositioned = currentNodes
        .filter(n => !pos[n.id])
        .sort((a, b) => nodeDepth(a.id) - nodeDepth(b.id))

      unpositioned.forEach(node => {
        const d = nodeDepth(node.id)
        const x = PAD_X + d * (NODE_W + H_GAP)
        
        const siblings = parentGroups[node.parent_node_id || '__root__']
        const positionedSiblings = siblings.filter(n => n.id !== node.id && pos[n.id])

        let y: number
        const isRoot = !node.parent_node_id;

        if (isRoot) {
          const allPositioned = Object.keys(pos);
          if (allPositioned.length > 0) {
            let maxY = PAD_Y;
            allPositioned.forEach(id => {
              const bottom = pos[id].y + h(id);
              if (bottom > maxY) maxY = bottom;
            });
            y = maxY;
          } else {
            y = PAD_Y;
          }
        } else if (positionedSiblings.length > 0) {
          const lastSibling = positionedSiblings.reduce((a, b) => pos[a.id].y > pos[b.id].y ? a : b)
          y = pos[lastSibling.id].y + h(lastSibling.id)
        } else if (node.parent_node_id && pos[node.parent_node_id]) {
          y = pos[node.parent_node_id].y
        } else {
          y = PAD_Y
        }
        pos[node.id] = { x, y }
      })

      // Re-space already-positioned siblings that may now overlap
      for (const key of Object.keys(parentGroups)) {
        const sorted = parentGroups[key].filter(n => pos[n.id] && !isNaN(pos[n.id].y))
        for (let i = 1; i < sorted.length; i++) {
          const prevNodeId = sorted[i - 1].id;
          const currNodeId = sorted[i].id;
          
          const prevBottom = pos[prevNodeId].y + h(prevNodeId)
          if (pos[currNodeId].y < prevBottom) {
            // Only bump if they are actually colliding, but ignore exact same Y overlaps 
            // since that indicates a replacement in progress where they share the exact slot
            // Also ignore if the previous node is a dummy, as we probably just want to overwrite it
            if (Math.abs(pos[currNodeId].y - pos[prevNodeId].y) > 1 && !prevNodeId.startsWith('dummy-')) {
              pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
            } else if (Math.abs(pos[currNodeId].y - pos[prevNodeId].y) > 1 && prevNodeId.startsWith('dummy-')) {
              // If previous is a dummy but they aren't exactly sharing a slot, 
              // we still want to avoid the dummy pushing down the real node aggressively, 
              // but we need them not to overlap visually. Let's push the dummy instead if possible,
              // or just accept the push if we have to.
              pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
            }
          }
        }
      }
    }

    return pos
  }

  // Initialize positions whenever nodes change
  useEffect(() => {
    setPositions(prev => {
      const allNodes = [...nodes, ...dummyNodes]
      const nodeIds = new Set(allNodes.map(n => n.id))
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([id]) => nodeIds.has(id))
      )
      
      let updatedWithDb = false;
      allNodes.forEach(n => {
        if (!n.id.startsWith('dummy-') && (n.settings as any)?.ui_position) {
          const dbPos = (n.settings as any).ui_position;
          if (!cleaned[n.id] || cleaned[n.id].x !== dbPos.x || cleaned[n.id].y !== dbPos.y) {
            // Avoid overwriting if we are currently dragging this node
            if (draggingNodeRef.current !== n.id) {
              cleaned[n.id] = dbPos;
              updatedWithDb = true;
            }
          }
        }
      });
      
      const hasMissing = allNodes.some(n => !cleaned[n.id])
      const hasStale = Object.keys(cleaned).length !== Object.keys(prev).length
      
      if (hasMissing || hasStale || updatedWithDb) {
        return getLayoutPositions(allNodes, cleaned, nodeHeightsRef.current)
      }
      return cleaned
    })
  }, [nodes, dummyNodes])

  // Calculate bounding box for canvas content size
  const maxBounds = useMemo(() => {
    let maxX = 800;
    let maxY = 600;
    
    // Safety check to ensure we only include valid coordinates, 
    // ignoring any leftover keys that might cause NaN jumps
    Object.entries(positions).forEach(([id, pos]) => {
      if (typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) return;
      
      const nh = (nodeHeightsRef.current[id] || ROW_H) + 50
      if (pos.x + NODE_W + 50 > maxX) maxX = pos.x + NODE_W + 50;
      if (pos.y + nh > maxY) maxY = pos.y + nh;
    });
    return { width: maxX, height: maxY };
  }, [positions])

  return (
    <div 
      className="h-full flex flex-col transition-all duration-300 relative"
      style={{
        marginLeft: `-${sidebarWidth}px`,
        width: `calc(100% + ${sidebarWidth}px)`
      }}
    >
      <div className="flex-1 relative">
        {!activeInstanceId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select an instance to view nodes
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading nodes...
          </div>
        ) : (
          <div className="absolute inset-0 z-0" onClick={() => setSelectedContextId(null)}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,video/*,audio/*,text/plain,application/pdf"
            />
            <ZoomableCanvas 
          dotSize="20px" 
          dotColorLight="rgba(0, 0, 0, 0.2)" 
          dotColorDark="rgba(255, 255, 255, 0.2)"
          fitOnChildrenChange={false}
          onSort={() => {
            toast.info("Organizing layout...");
            const allNodes = [...nodes, ...dummyNodes];
            const newPositions = getLayoutPositions(allNodes, {}, nodeHeightsRef.current);
            setPositions(newPositions);
            
            // Persist to DB in background
            const updates = nodes.map(n => {
              const pos = newPositions[n.id];
              if (pos) {
                const updatedSettings = { ...((n.settings as any) || {}), ui_position: pos };
                return supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', n.id);
              }
              return null;
            }).filter(Boolean);
            
            Promise.all(updates)
              .then(() => toast.success("Layout saved"))
              .catch(console.error);
          }}
          extraControls={
            activeInstanceId && nodes.length > 0 ? (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs font-medium px-2.5"
                  onClick={() => handleCreateChild(null)}
                  disabled={isUploadingAsset}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> New action
                </Button>
                <div className="w-px h-4 bg-border mx-1"></div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs font-medium px-2.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAsset}
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> {isUploadingAsset ? "Uploading..." : "New file"}
                </Button>
              </div>
            ) : null
          }
        >
            <div 
              id="imprenta-canvas-content" 
              className="relative transition-all duration-300" 
              style={{ minWidth: maxBounds.width, minHeight: maxBounds.height }}
              onClick={() => setSelectedContextId(null)}
            >
                  {/* Draw parent connections */}
                  {[...nodes, ...dummyNodes].map(node => {
                    if (!node.parent_node_id || !positions[node.id] || !positions[node.parent_node_id]) return null
                    const start = positions[node.parent_node_id]
                    const end = positions[node.id]
                    const startCy = (nodeHeightsRef.current[node.parent_node_id] || ROW_H) / 2
                    const endCy = (nodeHeightsRef.current[node.id] || ROW_H) / 2
                    return (
                      <svg key={`edge-${node.id}`} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0, overflow: 'visible' }}>
                        <path
                          d={`M ${start.x + NODE_W} ${start.y + startCy} C ${start.x + NODE_W + 50} ${start.y + startCy}, ${end.x - 50} ${end.y + endCy}, ${end.x} ${end.y + endCy}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-muted-foreground/30"
                        />
                      </svg>
                    )
                  })}
                  
                  {/* Draw context connections */}
                  {contexts.map(ctx => {
                    const start = positions[ctx.context_node_id]
                    const end = positions[ctx.target_node_id]
                    if (!start || !end) return null;
                    const startCy = (nodeHeightsRef.current[ctx.context_node_id] || ROW_H) / 2
                    const endCy = (nodeHeightsRef.current[ctx.target_node_id] || ROW_H) / 2
                    
                    const startX = start.x + NODE_W;
                    const startY = start.y + startCy;
                    const endX = end.x;
                    const endY = end.y + endCy;
                    
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    const isSelected = selectedContextId === ctx.id;
                    
                    return (
                      <div key={`ctx-wrapper-${ctx.id}`} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: isSelected ? 30 : 0 }}>
                        <svg className="absolute top-0 left-0 w-full h-full" style={{ overflow: 'visible' }}>
                          <path
                            d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={isSelected ? "4" : "2"}
                            className={`${isSelected ? 'text-primary' : 'text-primary/50'} stroke-dashed transition-all duration-200 cursor-pointer pointer-events-auto`}
                            strokeDasharray="4 4"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContextId(isSelected ? null : ctx.id);
                            }}
                          />
                          {/* Invisible thicker path for easier clicking */}
                          <path
                            d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="20"
                            className="cursor-pointer pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContextId(isSelected ? null : ctx.id);
                            }}
                          />
                        </svg>
                        
                        {/* Type Label (always visible if type exists and not selected) */}
                        {ctx.type && !isSelected && (
                          <div 
                            className="absolute px-2 py-0.5 bg-background border border-primary/20 text-primary text-[10px] font-medium rounded-full shadow-sm pointer-events-auto cursor-pointer"
                            style={{ 
                              left: midX, 
                              top: midY, 
                              transform: 'translate(-50%, -50%)' 
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContextId(ctx.id);
                            }}
                          >
                            {ctx.type}
                          </div>
                        )}
                        
                        {/* Floating UI for Selected Edge */}
                        {isSelected && (
                          <Card 
                            className="absolute pointer-events-auto shadow-xl border-primary/30 z-50 flex items-center gap-1 p-1"
                            style={{ 
                              left: midX, 
                              top: midY, 
                              transform: 'translate(-50%, -50%)' 
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Select 
                              value={ctx.type || "reference"} 
                              onValueChange={(val) => handleUpdateContextType(ctx.id, val)}
                            >
                              <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent px-2 w-[110px]">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reference">Reference</SelectItem>
                                <SelectItem value="style">Style</SelectItem>
                                <SelectItem value="negative">Negative</SelectItem>
                                <SelectItem value="context">Context</SelectItem>
                                <SelectItem value="data">Data</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="w-px h-4 bg-border mx-1"></div>
                            
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteContext(ctx.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </Card>
                        )}
                      </div>
                    )
                  })}

                  {/* Draw temp dragging connection */}
                  {tempConnection && positions[tempConnection.fromNode] && (() => {
                    const fromPos = positions[tempConnection.fromNode]
                    const fromCy = (nodeHeightsRef.current[tempConnection.fromNode] || ROW_H) / 2
                    return (
                      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 50, overflow: 'visible' }}>
                        <path
                          d={`M ${fromPos.x + NODE_W} ${fromPos.y + fromCy} C ${fromPos.x + NODE_W + 50} ${fromPos.y + fromCy}, ${tempConnection.currentX - 50} ${tempConnection.currentY}, ${tempConnection.currentX} ${tempConnection.currentY}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-primary"
                        />
                      </svg>
                    )
                  })()}
                  
                  {/* Draw nodes */}
                  {[...nodes, ...dummyNodes].map(node => {
                    const pos = positions[node.id] || { x: 100, y: 100 }
                    const hasResult = node.result && Object.keys(node.result).length > 0;
                    const isDummy = node.id.startsWith('dummy-');
                    
                    return (
                      <div 
                        key={node.id}
                        ref={(el) => registerNodeRef(node.id, el)}
                        data-node-id={node.id}
                        className={`absolute group cursor-grab active:cursor-grabbing ${isDummy ? 'opacity-70 animate-pulse' : ''}`}
                        style={{ 
                          left: pos.x, 
                          top: pos.y,
                          zIndex: 10
                        }}
                        onMouseDown={(e) => !isDummy && handleNodeMouseDown(e, node.id)}
                      >
                        {!isDummy && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-3 -right-3 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNode(node.id);
                            }}
                            title="Delete Node"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}

                        <Card className="w-[480px] shadow-[0_0_10px_rgba(0,0,0,0.05)] group-hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] transition-shadow duration-300 border-2 border-black/5 dark:border-white/10 bg-card/95 backdrop-blur-sm rounded-3xl">
                          <CardContent className="p-5 relative">
                            {!hasResult && !isDummy && (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 -left-3 w-4 h-4 bg-background border-2 border-muted-foreground rounded-full flex items-center justify-center z-20 hover:scale-125 transition-transform" 
                                title="Soltar contexto aquí"
                                onMouseUp={(e) => handleConnectionDrop(e, node.id)}
                              >
                                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full pointer-events-none" />
                              </div>
                            )}

                            {hasResult && (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 -right-3 w-4 h-4 bg-background border-2 border-primary rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 hover:scale-125 transition-transform" 
                                title="Arrastrar a un input de contexto"
                                onMouseDown={(e) => handleConnectionStart(e, node.id)}
                              >
                                <div className="w-1.5 h-1.5 bg-primary rounded-full pointer-events-none" />
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground uppercase leading-none">
                                  {hasResult ? 'Resultado' : node.type}
                                </span>
                                {hasResult && (
                                  <Badge variant={
                                    node.status === 'completed' ? 'success' as any :
                                    node.status === 'failed' ? 'destructive' :
                                    node.status === 'running' ? 'default' : 'secondary'
                                  } className="text-[10px] px-1.5 py-0">
                                    {node.status}
                                  </Badge>
                                )}
                              </div>
                              
                              {!hasResult && !isDummy && (
                                <>
                                  {/* Media Type Selector */}
                                  <div className="flex flex-wrap items-center bg-muted/50 p-1 rounded-2xl gap-1">
                                  <Button 
                                    variant={node.type === 'prompt' ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === 'prompt' ? 'bg-background shadow-sm border-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={async () => {
                                      await supabase.from('instance_nodes').update({ type: 'prompt' }).eq('id', node.id)
                                    }}
                                  >
                                    Text
                                  </Button>
                                  <Button 
                                    variant={node.type === 'generate-image' ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === 'generate-image' ? 'bg-background shadow-sm border-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={async () => {
                                      await supabase.from('instance_nodes').update({ type: 'generate-image' }).eq('id', node.id)
                                    }}
                                  >
                                    Image
                                  </Button>
                                  <Button 
                                    variant={node.type === 'generate-video' ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === 'generate-video' ? 'bg-background shadow-sm border-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={async () => {
                                      await supabase.from('instance_nodes').update({ type: 'generate-video' }).eq('id', node.id)
                                    }}
                                  >
                                    Video
                                  </Button>
                                  <Button 
                                    variant={node.type === 'generate-audio' ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === 'generate-audio' ? 'bg-background shadow-sm border-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={async () => {
                                      await supabase.from('instance_nodes').update({ type: 'generate-audio' }).eq('id', node.id)
                                    }}
                                  >
                                    Audio
                                  </Button>
                                  <Button 
                                    variant={node.type === 'generate-audience' ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === 'generate-audience' ? 'bg-background shadow-sm border-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={async () => {
                                      await supabase.from('instance_nodes').update({ type: 'generate-audience' }).eq('id', node.id)
                                    }}
                                  >
                                    Audience
                                  </Button>
                                  <Button 
                                    variant={node.type === 'publish' ? 'outline' : 'ghost'} 
                                    size="sm" 
                                    className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === 'publish' ? 'bg-background shadow-sm border-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={async () => {
                                      await supabase.from('instance_nodes').update({ type: 'publish' }).eq('id', node.id)
                                    }}
                                  >
                                    Publish
                                  </Button>
                                </div>
                                
                                <Textarea 
                                  defaultValue={node.prompt?.text || ''}
                                  onBlur={async (e) => {
                                    const newText = e.target.value;
                                    if (newText !== node.prompt?.text) {
                                      const { error } = await supabase
                                        .from('instance_nodes')
                                        .update({ prompt: { ...node.prompt, text: newText } })
                                        .eq('id', node.id);
                                        
                                      if (error) {
                                        toast.error("Failed to save node text");
                                        console.error(error);
                                      }
                                    }
                                  }}
                                  className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-secondary min-h-[60px] max-h-[150px]"
                                  placeholder={node.type === 'publish' ? "Optional: custom instructions for publishing..." : "Type to edit prompt..."}
                                />
                                
                                {node.type === 'generate-audience' && (
                                  <div className="flex items-center gap-2">
                                    {([
                                      { key: 'email', label: 'Email', icon: Mail },
                                      { key: 'web', label: 'Web', icon: Globe },
                                      { key: 'phone', label: 'Phone', icon: Phone },
                                    ] as const).map(({ key, label, icon: Icon }) => {
                                      const isSelected = (node.settings as any)?.audience_channels?.includes(key);
                                      return (
                                        <button
                                          key={key}
                                          className={`h-8 px-3 rounded-xl text-xs flex items-center gap-2 border transition-colors ${isSelected ? 'bg-secondary border-secondary text-foreground' : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const current = (node.settings as any)?.audience_channels || [];
                                            const newChannels = isSelected
                                              ? current.filter((c: string) => c !== key)
                                              : [...current, key];
                                            await supabase.from('instance_nodes').update({
                                              settings: { ...((node.settings as any) || {}), audience_channels: newChannels }
                                            }).eq('id', node.id);
                                          }}
                                        >
                                          <Icon className="h-4 w-4" />
                                          <span>{label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {node.type === 'publish' && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(currentSite?.settings?.social_media || []).map((sm: any, idx: number) => {
                                      if (!sm.platform || sm.isActive === false) return null;
                                      const isSelected = (node.settings as any)?.publish_destinations?.includes(sm.platform);
                                      return (
                                        <button
                                          key={`sm-${idx}`}
                                          className={`h-8 px-3 rounded-xl text-xs flex items-center gap-2 border transition-colors ${isSelected ? 'bg-secondary border-secondary text-foreground' : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const currentDest = (node.settings as any)?.publish_destinations || [];
                                            const newDest = isSelected 
                                              ? currentDest.filter((d: string) => d !== sm.platform)
                                              : [...currentDest, sm.platform];
                                            await supabase.from('instance_nodes').update({
                                              settings: { ...((node.settings as any) || {}), publish_destinations: newDest }
                                            }).eq('id', node.id);
                                          }}
                                        >
                                          <SocialIcon platform={sm.platform} size={14} color={isSelected ? "currentColor" : undefined} />
                                          <span className="capitalize">{sm.platform}</span>
                                        </button>
                                      )
                                    })}
                                    
                                    {(() => {
                                       const isSelected = (node.settings as any)?.publish_destinations?.includes('blog');
                                       return (
                                         <button
                                           className={`h-8 px-3 rounded-xl text-xs flex items-center gap-2 border transition-colors ${isSelected ? 'bg-secondary border-secondary text-foreground' : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                           onClick={async (e) => {
                                             e.stopPropagation();
                                             const currentDest = (node.settings as any)?.publish_destinations || [];
                                             const newDest = isSelected 
                                               ? currentDest.filter((d: string) => d !== 'blog')
                                               : [...currentDest, 'blog'];
                                             await supabase.from('instance_nodes').update({
                                               settings: { ...((node.settings as any) || {}), publish_destinations: newDest }
                                             }).eq('id', node.id);
                                           }}
                                         >
                                           <Globe className="h-4 w-4" />
                                           <span>Blog</span>
                                         </button>
                                       )
                                    })()}
                                    
                                    {(() => {
                                       const isNewsletterAvailable = currentSite?.settings?.channels?.email?.status === 'synced';
                                       if (!isNewsletterAvailable) return null;
                                       
                                       const isSelected = (node.settings as any)?.publish_destinations?.includes('newsletter');
                                       return (
                                         <button
                                           className={`h-8 px-3 rounded-xl text-xs flex items-center gap-2 border transition-colors ${isSelected ? 'bg-secondary border-secondary text-foreground' : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                           onClick={async (e) => {
                                             e.stopPropagation();
                                             const currentDest = (node.settings as any)?.publish_destinations || [];
                                             const newDest = isSelected 
                                               ? currentDest.filter((d: string) => d !== 'newsletter')
                                               : [...currentDest, 'newsletter'];
                                             await supabase.from('instance_nodes').update({
                                               settings: { ...((node.settings as any) || {}), publish_destinations: newDest }
                                             }).eq('id', node.id);
                                           }}
                                         >
                                           <Mail className="h-4 w-4" />
                                           <span>Newsletter</span>
                                         </button>
                                       )
                                    })()}
                                    
                                    {(() => {
                                       const isWhatsappAvailable = currentSite?.settings?.channels?.whatsapp?.status === 'active' || currentSite?.settings?.channels?.agent_whatsapp?.status === 'active';
                                       if (!isWhatsappAvailable) return null;
                                       
                                       const isSelected = (node.settings as any)?.publish_destinations?.includes('whatsapp');
                                       return (
                                         <button
                                           className={`h-8 px-3 rounded-xl text-xs flex items-center gap-2 border transition-colors ${isSelected ? 'bg-secondary border-secondary text-foreground' : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                           onClick={async (e) => {
                                             e.stopPropagation();
                                             const currentDest = (node.settings as any)?.publish_destinations || [];
                                             const newDest = isSelected 
                                               ? currentDest.filter((d: string) => d !== 'whatsapp')
                                               : [...currentDest, 'whatsapp'];
                                             await supabase.from('instance_nodes').update({
                                               settings: { ...((node.settings as any) || {}), publish_destinations: newDest }
                                             }).eq('id', node.id);
                                           }}
                                         >
                                           <SocialIcon platform="whatsapp" size={14} color={isSelected ? "currentColor" : undefined} />
                                           <span>WhatsApp</span>
                                         </button>
                                       )
                                    })()}
                                  </div>
                                )}
                                
                                {node.type !== 'publish' && node.type !== 'generate-audience' && (
                                  <div className="flex justify-start w-full">
                                    <MediaParametersToolbar
                                      selectedActivity={node.type}
                                      textParameters={(node.settings as any)?.parameters || textParams}
                                      imageParameters={(node.settings as any)?.parameters || imageParams}
                                      videoParameters={(node.settings as any)?.parameters || videoParams}
                                      audioParameters={(node.settings as any)?.parameters || audioParams}
                                      onTextParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || textParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'text', parameters: newParams };
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onImageParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || imageParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'image', parameters: newParams };
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onVideoParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || videoParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'video', parameters: newParams };
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onAudioParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || audioParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'audio', parameters: newParams };
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                            
                              {hasResult && (
                                <div className="flex flex-col gap-2">
                                {(node.result as any).outputs && Array.isArray((node.result as any).outputs) && (
                                  <div className="flex flex-col gap-2">
                                    {(node.result as any).outputs.map((outputItem: any, idx: number) => {
                                      const url = outputItem.data?.url || outputItem.url;
                                      if (!url) return null;
                                      if (outputItem.type === 'image') {
                                        return <img key={idx} src={url} alt="Generated media" className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                      }
                                      if (outputItem.type === 'video') {
                                        return <video key={idx} src={url} controls className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                      }
                                      if (outputItem.type === 'audio') {
                                        return <audio key={idx} src={url} controls className="w-full" />
                                      }
                                      return null;
                                    })}
                                  </div>
                                )}
                                {(node.result as any).media && Array.isArray((node.result as any).media) && (
                                  <div className="flex flex-col gap-2">
                                    {(node.result as any).media.map((mediaItem: any, idx: number) => {
                                      if (!mediaItem.url) return null;
                                      if (mediaItem.type === 'image') {
                                        return <img key={idx} src={mediaItem.url} alt="Generated media" className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                      }
                                      if (mediaItem.type === 'video') {
                                        return <video key={idx} src={mediaItem.url} controls className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                      }
                                      if (mediaItem.type === 'audio') {
                                        return <audio key={idx} src={mediaItem.url} controls className="w-full" />
                                      }
                                      return null;
                                    })}
                                  </div>
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && (node.result as any).images && Array.isArray((node.result as any).images) && (
                                  <div className="flex flex-col gap-2">
                                    {(node.result as any).images.map((img: any, idx: number) => (
                                      img.url && <img key={idx} src={img.url} alt="Generated media" className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                    ))}
                                  </div>
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && !(node.result as any).images && (node.result as any).image && (node.result as any).image.url && (
                                  <img src={(node.result as any).image.url} alt="Generated media" className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && (node.result as any).video && (node.result as any).video.url && (
                                  <video src={(node.result as any).video.url} controls className="w-full rounded-xl object-cover object-center bg-black/10 max-h-[300px]" />
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && (node.result as any).audio && (node.result as any).audio.url && (
                                  <audio src={(node.result as any).audio.url} controls className="w-full" />
                                )}
                                {((node.result as any).text || (!(node.result as any).outputs && !(node.result as any).media && !(node.result as any).images && !(node.result as any).image && !(node.result as any).video && !(node.result as any).audio && !(node.result as any).text)) && (
                                  <div className="text-xs bg-accent/10 border border-accent/20 p-3 rounded-xl text-accent-foreground max-h-[200px] overflow-y-auto custom-scrollbar prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                      {(node.result as any).text 
                                        ? String((node.result as any).text) 
                                        : "```json\n" + JSON.stringify(node.result, null, 2) + "\n```"}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </div>
                            )}
                            
                              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                              {hasResult ? (
                                <div className="flex gap-2 w-full">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const parentNode = node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : null;
                                      if (parentNode) {
                                        handleExecuteNode(parentNode);
                                      } else {
                                        handleExecuteNode(node); // Fallback: execute current if root
                                      }
                                    }}
                                    title="New Variant"
                                  >
                                    <GitFork className="w-4 h-4 mr-2" /> Variant
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateActionFromContext(node.id);
                                    }}
                                    title="New Action"
                                  >
                                    <Plus className="w-4 h-4 mr-2" /> Action
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const res = node.result as any;
                                      let textToCopy = "";
                                      
                                      if (res.outputs && Array.isArray(res.outputs) && res.outputs.length > 0 && (res.outputs[0]?.data?.url || res.outputs[0]?.url)) textToCopy = String(res.outputs[0].data?.url || res.outputs[0].url);
                                      else if (res.media && Array.isArray(res.media) && res.media.length > 0 && res.media[0]?.url) textToCopy = String(res.media[0].url);
                                      else if (res.url) textToCopy = String(res.url);
                                      else if (res.images && res.images.length > 0 && res.images[0]?.url) textToCopy = String(res.images[0].url);
                                      else if (res.image && res.image.url) textToCopy = String(res.image.url);
                                      else if (res.audio && res.audio.url) textToCopy = String(res.audio.url);
                                      else if (res.video && res.video.url) textToCopy = String(res.video.url);
                                      else if (res.text) textToCopy = String(res.text);
                                      else textToCopy = JSON.stringify(res, null, 2);
                                      
                                      try {
                                        await navigator.clipboard.writeText(textToCopy);
                                        toast.success("Copied to clipboard");
                                      } catch (err) {
                                        toast.error("Failed to copy");
                                      }
                                    }}
                                    title="Copy Result"
                                  >
                                    <Copy className="h-4 w-4 mr-2" /> Copy
                                  </Button>
                                </div>
                              ) : !isDummy ? (
                                <div className="flex w-full">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full" 
                                    title="Generate"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExecuteNode(node);
                                    }}
                                  >
                                    <Play className="w-4 h-4 mr-2" /> Generate
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })}
            </div>
            </ZoomableCanvas>
          </div>
        )}
      </div>
    </div>
  )
}