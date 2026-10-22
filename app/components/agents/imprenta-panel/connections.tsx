import { useEffect, useCallback } from "react"
import { sizedAncestorRect, screenToWorld } from "@/app/lib/imprenta-world-svg"
import { isPublishAudienceSourceReady, shouldRouteToPublishAudienceSlot, PUBLISH_SLOT_AUDIENCE, PUBLISH_SLOT_CONTENT, PUBLISH_SLOT_REFERENCE } from "@/app/components/agents/imprenta-publish-context"
import { toast } from "sonner"

import type { useImprentaPanelState } from './state'
import type { useImprentaLayout } from "./graph-layout"

type ImprentaConnectionsOptions = Pick<ReturnType<typeof useImprentaPanelState>, "drawingConnectionRef" | "lastConnectionPointerRef" | "connectionMoveRafRef" | "viewportStore" | "connectionStore" | "setTempConnection" | "handleConnectionCancelRef" | "positionsRef" | "nodeHeightsRef" | "nodesRef" | "logs" | "supabase" | "currentSite" | "contexts" | "persistenceBarrier" | "setContexts" | "selectedContextId" | "setSelectedContextId" | "setSelectedContextAnchor"> & Pick<ReturnType<typeof useImprentaLayout>, "NODE_W" | "ROW_H">

export function useImprentaConnections({
  drawingConnectionRef,
  lastConnectionPointerRef,
  connectionMoveRafRef,
  viewportStore,
  connectionStore,
  setTempConnection,
  handleConnectionCancelRef,
  positionsRef,
  NODE_W,
  nodeHeightsRef,
  ROW_H,
  nodesRef,
  logs,
  supabase,
  currentSite,
  contexts,
  persistenceBarrier,
  setContexts,
  selectedContextId,
  setSelectedContextId,
  setSelectedContextAnchor,
}: ImprentaConnectionsOptions) {
  const handleConnectionMove = useCallback((e: Event) => {
    if (!drawingConnectionRef.current) return;
    if (!("clientX" in e) || !("clientY" in e)) return;
    const { clientX, clientY } = e as MouseEvent;

    lastConnectionPointerRef.current = { x: clientX, y: clientY };
    if (connectionMoveRafRef.current != null) return;

    connectionMoveRafRef.current = requestAnimationFrame(() => {
      connectionMoveRafRef.current = null;
      const drawing = drawingConnectionRef.current;
      const ptr = lastConnectionPointerRef.current;
      if (!drawing || !ptr) return;

      const snap = viewportStore.get();
      const contentDiv = document.getElementById("imprenta-canvas-content");
      // Graph content is 0×0 (all nodes are absolute); Chrome's rect on that
      // node is not a reliable origin. Use the sized zoomable-canvas ancestor.
      const rect = sizedAncestorRect(contentDiv);
      if (!rect) return;

      const { x: currentX, y: currentY } = screenToWorld(
        ptr.x,
        ptr.y,
        rect,
        snap?.position || { x: 0, y: 0 },
        snap?.scale || 1
      );

      connectionStore.set({
        fromNode: drawing.fromNode,
        toX: currentX,
        toY: currentY,
      });
    });
  }, [viewportStore, connectionStore]);

  const unbindConnectionMove = useCallback(() => {
    window.removeEventListener("pointermove", handleConnectionMove, true);
    window.removeEventListener("mousemove", handleConnectionMove, true);
    if (connectionMoveRafRef.current != null) {
      cancelAnimationFrame(connectionMoveRafRef.current);
      connectionMoveRafRef.current = null;
    }
  }, [handleConnectionMove]);

  const handleConnectionCancel = useCallback(() => {
    drawingConnectionRef.current = null;
    lastConnectionPointerRef.current = null;
    connectionStore.set(null);
    setTempConnection(null);
    unbindConnectionMove();
  }, [connectionStore, unbindConnectionMove]);

  handleConnectionCancelRef.current = handleConnectionCancel

  useEffect(() => {
    return () => {
      unbindConnectionMove()
      connectionStore.set(null)
    }
  }, [unbindConnectionMove, connectionStore])

  const handleConnectionStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();

    // Toggle off if clicking the same source knob again
    if (drawingConnectionRef.current && drawingConnectionRef.current.fromNode === nodeId) {
      handleConnectionCancel();
      return;
    }

    const startPos = positionsRef.current[nodeId] || { x: 0, y: 0 };
    const startX = startPos.x + NODE_W;
    const startY = startPos.y + (nodeHeightsRef.current[nodeId] || ROW_H) / 2;

    drawingConnectionRef.current = {
      fromNode: nodeId,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      nodeStartX: startX,
      nodeStartY: startY
    };

    lastConnectionPointerRef.current = { x: e.clientX, y: e.clientY };
    connectionStore.set({ fromNode: nodeId, toX: startX, toY: startY });
    setTempConnection({ fromNode: nodeId });

    window.addEventListener("pointermove", handleConnectionMove, true);
    window.addEventListener("mousemove", handleConnectionMove, true);
    handleConnectionMove(e.nativeEvent);
  }

  const handleConnectionDrop = async (
    e: React.MouseEvent,
    targetNodeId: string,
    slot?: "content" | "context" | "audience"
  ) => {
    e.stopPropagation();
    if (!drawingConnectionRef.current) return;

    const sourceNodeId = drawingConnectionRef.current.fromNode;
    handleConnectionCancel(); // Clean up the connection line first

    if (sourceNodeId === targetNodeId) return;

    const targetNode = nodesRef.current.find((n) => n.id === targetNodeId);
    const sourceNode = nodesRef.current.find((n) => n.id === sourceNodeId);
    if (!targetNode || !sourceNode) return;

    let insertType: string | null = null;
    if (targetNode.type === "publish" && slot === "content") {
      if (shouldRouteToPublishAudienceSlot(sourceNode, nodesRef.current)) {
        toast.error("Use the Audience input for Audience nodes and their downstream actions.");
        return;
      }
      insertType = PUBLISH_SLOT_CONTENT;
    } else if (targetNode.type === "publish" && slot === "context") {
      if (shouldRouteToPublishAudienceSlot(sourceNode, nodesRef.current)) {
        toast.error("Use the Audience input for Audience nodes and their downstream actions.");
        return;
      }
      insertType = PUBLISH_SLOT_REFERENCE;
    } else if (targetNode.type === "publish" && slot === "audience") {
      if (!isPublishAudienceSourceReady(sourceNode, nodesRef.current, logs)) {
        toast.error("Link from an Audience node or from a node whose parent is an Audience node.");
        return;
      }
      insertType = PUBLISH_SLOT_AUDIENCE;
    } else if (targetNode.type === "publish") {
      toast.error("Use the Content, Context, or Audience inputs on the left.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !currentSite) return;

    try {
      if (insertType === PUBLISH_SLOT_AUDIENCE) {
        const stale = contexts.filter(
          (c) => c.target_node_id === targetNodeId && c.type === PUBLISH_SLOT_AUDIENCE
        );
        for (const row of stale) {
          await persistenceBarrier.track(
            targetNodeId,
            supabase.from("instance_node_contexts").delete().eq("id", row.id),
            "context"
          );
        }
        if (stale.length) {
          setContexts((prev) => prev.filter((c) => !stale.some((s) => s.id === c.id)));
        }
      }

      const { error } = await persistenceBarrier.track<{ error: { code?: string } | null }>(
        targetNodeId,
        supabase.from("instance_node_contexts").insert([{
          target_node_id: targetNodeId,
          context_node_id: sourceNodeId,
          site_id: currentSite.id,
          user_id: session.user.id,
          ...(insertType ? { type: insertType } : {}),
        }]),
        "context"
      );

      if (error) {
        if (error.code === "23505") toast.error("Context already linked");
        else toast.error("Failed to link context");
      } else {
        toast.success("Context linked!");
        const currentNodeIds = nodesRef.current.map((n) => n.id);
        const { data } = await supabase
          .from("instance_node_contexts")
          .select("*")
          .in("target_node_id", currentNodeIds);
        if (data) setContexts(data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to link context");
    }
  };

  const handleDeleteContext = async (contextId: string) => {
    try {
      const targetNodeId = contexts.find((context) => context.id === contextId)?.target_node_id
      const operation = supabase
        .from('instance_node_contexts')
        .delete()
        .eq('id', contextId);
      const { error } = targetNodeId
        ? await persistenceBarrier.track(targetNodeId, operation, "context")
        : await operation;

      if (error) throw error;

      toast.success("Connection deleted");
      setContexts(prev => prev.filter(c => c.id !== contextId));
      if (selectedContextId === contextId) {
        setSelectedContextId(null);
        setSelectedContextAnchor(null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete connection");
    }
  }

  const handleUpdateContextType = async (contextId: string, type: string) => {
    try {
      const targetNodeId = contexts.find((context) => context.id === contextId)?.target_node_id
      setContexts(prev => prev.map(c => c.id === contextId ? { ...c, type } : c));
      const operation = supabase
        .from('instance_node_contexts')
        .update({ type })
        .eq('id', contextId);
      const { error } = targetNodeId
        ? await persistenceBarrier.track(targetNodeId, operation, "context")
        : await operation;

      if (error) throw error;

      toast.success("Connection type updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update connection type");
      // Refetch contexts on failure to revert
      const currentNodes = nodesRef.current.map(n => n.id)
      if (currentNodes.length > 0) {
        const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes)
        if (data) setContexts(data)
      }
    }
  }

  return { handleConnectionMove, unbindConnectionMove, handleConnectionCancel, handleConnectionStart, handleConnectionDrop, handleDeleteContext, handleUpdateContextType }
}
