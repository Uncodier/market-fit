import { InstanceNode } from "@/app/types/instance-nodes"
import { toast } from "sonner"
import { useEffect } from "react"
import { isImprentaWorkflowActionNode, IMPRENTA_MODE_OPTIONS, imprentaSettingsForClonedType, cloneInstanceNodeContextRowForInsert } from './node-helpers'
import { FALLBACK_POS } from './preview-helpers'
import type { useImprentaPanelState } from './state'

type ImprentaNodeActionsOptions = Pick<ReturnType<typeof useImprentaPanelState>, "nodes" | "deletedNodeIdsRef" | "setNodes" | "supabase" | "currentSite" | "nodesRef" | "positionsRef" | "setContexts" | "viewportStoreRef" | "selectedMediaType" | "textParams" | "imageParams" | "videoParams" | "audioParams" | "drawingConnectionRef" | "handleConnectionCancelRef" | "isUploadingAsset" | "fileInputRef"> & { activeInstanceId?: string }

export function useImprentaNodeActions({
  nodes,
  deletedNodeIdsRef,
  setNodes,
  supabase,
  currentSite,
  nodesRef,
  positionsRef,
  setContexts,
  viewportStoreRef,
  selectedMediaType,
  textParams,
  imageParams,
  videoParams,
  audioParams,
  drawingConnectionRef,
  handleConnectionCancelRef,
  isUploadingAsset,
  fileInputRef,
  activeInstanceId,
}: ImprentaNodeActionsOptions) {
  const handleDeleteNode = async (nodeId: string) => {
    // Keep a backup in case the deletion fails
    const previousNodes = [...nodes];

    const getNodesToDeleteBottomUp = (rootId: string, currentNodes: InstanceNode[]): InstanceNode[] => {
      const result: InstanceNode[] = [];

      const traverse = (id: string) => {
        const children = currentNodes.filter(n => n.parent_node_id === id);
        for (const child of children) {
          traverse(child.id);
        }
        const node = currentNodes.find(n => n.id === id);
        if (node) result.push(node);
      };

      traverse(rootId);
      return result;
    };

    const nodesToDelete = getNodesToDeleteBottomUp(nodeId, nodes);
    const nodeIdsToDelete = nodesToDelete.map(n => n.id);

    if (nodesToDelete.length === 0) return;

    // Optimistic update to remove them from UI immediately
    nodeIdsToDelete.forEach(id => deletedNodeIdsRef.current.add(id));
    setNodes(prev => prev.filter(n => !nodeIdsToDelete.includes(n.id)));

    try {
      // First, delete any contexts associated with these nodes to avoid foreign key constraints
      // if they don't have ON DELETE CASCADE
      await supabase
        .from('instance_node_contexts')
        .delete()
        .or(`target_node_id.in.(${nodeIdsToDelete.join(',')}),context_node_id.in.(${nodeIdsToDelete.join(',')})`);

      // Delete the nodes (bottom-up to avoid parent-child foreign key constraints if done sequentially)
      // We do it sequentially to be absolutely safe about FK constraints
      for (const node of nodesToDelete) {
        const { error } = await supabase
          .from('instance_nodes')
          .delete()
          .eq('id', node.id);

        if (error) throw error;
      }

      // Delete associated asset files if they were uploaded in imprenta mode
      for (const node of nodesToDelete) {
        if ((node.settings)?.imprenta_mode) {
          const url = (node.result)?.outputs?.[0]?.url;
          if (url) {
            const urlParts = url.split('/');
            const storagePath = urlParts[urlParts.length - 2] + '/' + urlParts[urlParts.length - 1];
            supabase.storage.from('assets').remove([storagePath]).catch((err: unknown) => {
              console.error("Failed to delete storage asset for node:", node.id, err);
            });
          }
        }
      }

      toast.success(nodesToDelete.length > 1 ? `Deleted node and ${nodesToDelete.length - 1} children` : "Node deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete node(s)");
      // Restore on failure
      nodeIdsToDelete.forEach(id => deletedNodeIdsRef.current.delete(id));
      setNodes(previousNodes);
    }
  }

  const cloneImprentaNodeWithType = async (nodeId: string, newType: string) => {
    if (!currentSite || !activeInstanceId) return
    const source = nodesRef.current.find((n) => n.id === nodeId)
    if (!source || !isImprentaWorkflowActionNode(source)) return
    if (!IMPRENTA_MODE_OPTIONS.some((o) => o.type === newType)) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const curPos = positionsRef.current[nodeId] || FALLBACK_POS
    const offset = 48
    const newPos = { x: curPos.x + offset, y: curPos.y + offset }

    let clonedSettings: Record<string, unknown>
    try {
      clonedSettings = JSON.parse(JSON.stringify(source.settings || {})) as Record<string, unknown>
    } catch {
      clonedSettings = { ...(source.settings || {}) } as Record<string, unknown>
    }
    clonedSettings = imprentaSettingsForClonedType(newType, clonedSettings)
    clonedSettings.ui_position = newPos

    let clonedPrompt: Record<string, unknown>
    try {
      clonedPrompt = JSON.parse(JSON.stringify(source.prompt || {})) as Record<string, unknown>
    } catch {
      clonedPrompt = { ...(source.prompt || {}) } as Record<string, unknown>
    }

    const newRow = {
      instance_id: source.instance_id,
      site_id: source.site_id,
      user_id: session.user.id,
      parent_node_id: source.parent_node_id,
      original_node_id: null as string | null,
      parent_instance_log_id: null as string | null,
      type: newType,
      status: "pending" as const,
      prompt: clonedPrompt,
      settings: clonedSettings,
      result: {},
    }

    const modeLabel = IMPRENTA_MODE_OPTIONS.find((o) => o.type === newType)?.label ?? newType

    try {
      const { data: created, error } = await supabase
        .from("instance_nodes")
        .insert([newRow])
        .select("*")
        .single()

      if (error || !created) {
        console.error(error)
        toast.error("Failed to create node")
        return
      }

      const { data: ctxRows, error: ctxLoadError } = await supabase
        .from("instance_node_contexts")
        .select("*")
        .eq("target_node_id", nodeId)

      if (ctxLoadError) {
        console.error(ctxLoadError)
        toast.error("Node created but context links could not be loaded to copy them")
      } else {
        const rows = (ctxRows || []) as Record<string, unknown>[]
        let anyCtxFailed = false
        for (const c of rows) {
          if (!c.context_node_id) continue
          const payload = cloneInstanceNodeContextRowForInsert(
            c,
            created.id,
            currentSite.id,
            session.user.id
          )
          const { error: ctxErr } = await supabase.from("instance_node_contexts").insert([payload])
          if (ctxErr) {
            console.error(ctxErr)
            anyCtxFailed = true
          }
        }
        if (anyCtxFailed) {
          toast.error("Node created but one or more context links failed to copy")
        }
      }

      const mergedIds = nodesRef.current.map((n) => n.id)
      if (!mergedIds.includes(created.id)) mergedIds.push(created.id)
      const { data: ctxRefetch } = await supabase
        .from("instance_node_contexts")
        .select("*")
        .in("target_node_id", mergedIds)
      if (ctxRefetch) setContexts(ctxRefetch)

      const sameType = newType === source.type
      toast.success(sameType ? "Node duplicated" : `New ${modeLabel} node created`)
    } catch (e) {
      console.error(e)
      toast.error("Failed to create node")
    }
  }

  const handleDuplicateNode = async (nodeId: string) => {
    const source = nodesRef.current.find((n) => n.id === nodeId)
    if (!source) return
    await cloneImprentaNodeWithType(nodeId, source.type)
  }

  const handleCreateChild = async (parentId: string | null = null, promptText: string = "New node prompt") => {
    if (!activeInstanceId || !currentSite) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const snap = viewportStoreRef.current?.get()
    let initialPosition = undefined
    if (!parentId && snap && snap.canvasWidth > 0 && snap.canvasHeight > 0) {
      initialPosition = {
        x: (snap.canvasWidth / 2 - snap.position.x) / snap.scale - 240,
        y: (snap.canvasHeight / 2 - snap.position.y) / snap.scale - 150,
      }
    }

    // Pass media type and params into settings
    const nodeSettings: InstanceNode["settings"] = selectedMediaType === 'text'
      ? { media_type: 'text', parameters: textParams }
      : {
        media_type: selectedMediaType,
        parameters: selectedMediaType === 'image' ? imageParams :
          selectedMediaType === 'video' ? videoParams :
            selectedMediaType === 'audio' ? audioParams : {}
      };

    if (initialPosition) {
      nodeSettings.ui_position = initialPosition
    }

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

    const { data, error } = await supabase.from('instance_nodes').insert([newNode]).select('*').single()
    if (error) {
      toast.error("Failed to create node")
      console.error(error)
      return null
    } else {
      setNodes(prev => {
        if (prev.some(n => n.id === data.id)) return prev;
        return [...prev, data as InstanceNode];
      });
      toast.success("Node created")
      return data.id
    }
  }

  useEffect(() => {
    if (!activeInstanceId || nodes.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Let Escape cancel the connection at any time
      if (e.key === "Escape") {
        if (drawingConnectionRef.current) {
          e.preventDefault();
          handleConnectionCancelRef.current();
        }
      }

      const t = e.target
      if (t instanceof HTMLElement) {
        const tag = t.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!e.shiftKey) return
      if (isUploadingAsset) return

      if (e.key === "N" || e.key === "n") {
        e.preventDefault()
        handleCreateChild(null)
      } else if (e.key === "U" || e.key === "u") {
        e.preventDefault()
        fileInputRef.current?.click()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeInstanceId, nodes.length, isUploadingAsset])

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

    const { data: actionNode, error } = await supabase.from('instance_nodes').insert([newNode]).select('*').single()
    if (error || !actionNode) {
      toast.error("Failed to create action node")
      return
    }

    setNodes(prev => {
      if (prev.some(n => n.id === actionNode.id)) return prev;
      return [...prev, actionNode as InstanceNode];
    });

    toast.success("Action node created")
  }

  return { handleDeleteNode, cloneImprentaNodeWithType, handleDuplicateNode, handleCreateChild, handleCreateActionFromContext }
}
