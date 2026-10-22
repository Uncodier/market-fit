import { ImprentaSkeleton } from "@/app/components/skeletons/imprenta-skeleton"
import { ZoomableCanvas } from "../zoomable-canvas"
import { ImprentaParentEdgesCanvas } from "../imprenta-parent-edges-canvas"
import { ImprentaNodesCanvas } from "../imprenta-nodes-canvas"
import { ImprentaTempConnectionCanvas } from "../imprenta-temp-connection-canvas"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Button } from "@/app/components/ui/button"
import { Plus, Trash2, UploadCloud, X } from "@/app/components/ui/icons"
import { ImprentaContextEdges } from "../imprenta-context-edges"
import { destinationsRequireAudience, getPublishContextAnchorY, getPublishContextEdgeCaption, hasPublishAudienceInput, hasPublishContentInput } from "@/app/components/agents/imprenta-publish-context"
import { ScreenAnchoredPanel } from "@/app/components/ui/screen-anchored-panel"
import { Card } from "@/app/components/ui/card"
import { ImprentaContextTypeSelect } from "@/app/components/agents/imprenta-context-type-select"
import { ImprentaLoadingRouteEdges } from "../imprenta-world-svg"
import { createPortal } from "react-dom"
import { IMPRENTA_LOD_FULL_DETAIL_SCALE, IMPRENTA_LOD_LITE_MARKER_MAX, IMPRENTA_LOD_LITE_MICRO_MAX, IMPRENTA_LOD_LITE_SIMPLE_MAX, FALLBACK_POS, estimateImprentaNodeContentHeight } from './preview-helpers'
import { imprentaNodeHasResult } from './result-helpers'
import { ImprentaDummyCardInner } from './dummy-card'
import { ImprentaLiteGraphNode } from './lite-node'
import { ImprentaNodeCardInner } from './node-card'
import type { useImprentaPanelState } from './state'
import type { useImprentaLayoutEffects } from './layout-effects'
import type { useImprentaMeasurement } from './measurement'
import type { useImprentaVirtualization } from './virtualization'
import type { useImprentaLayout } from "./graph-layout"
import type { useImprentaDragging } from './drag'
import type { useImprentaNodeActions } from './node-actions'
import type { useImprentaConnections } from './connections'
import type { useImprentaMedia } from './media'

type ImprentaPanelViewOptions = Pick<ReturnType<typeof useImprentaPanelState>, "sidebarWidth" | "isImprentaLoading" | "setSelectedContextId" | "fileInputRef" | "handleFileChange" | "nodes" | "viewportStore" | "dragStore" | "hoverStore" | "thumbCache" | "tempConnection" | "draggingNodeId" | "connectionStore" | "dummyNodes" | "nodeHeightsRef" | "setPositions" | "setNodes" | "supabase" | "isUploadingAsset" | "setSelectedContextAnchor" | "contexts" | "nodesRef" | "positions" | "selectedContextId" | "selectedContextAnchor" | "generatingNodeIds" | "viewportInfo" | "logs" | "currentSite" | "textParams" | "imageParams" | "videoParams" | "audioParams" | "zoomedMedia" | "setZoomedMedia"> & Pick<ReturnType<typeof useImprentaLayoutEffects>, "maxBounds" | "actionsRef"> & Pick<ReturnType<typeof useImprentaMeasurement>, "canvasNodes" | "isDarkMode" | "registerNodeRef"> & Pick<ReturnType<typeof useImprentaVirtualization>, "stablePositions" | "nodeHeightsSnapshot" | "parentEdgeStroke" | "parentEdgeHoverStroke" | "isLargeGraph" | "mountedNodeIds" | "canvasGetImages" | "canvasGetVideos" | "visibleNodeIds" | "resolveNodePosition" | "nodesById" | "slicedRenderNodes" | "resolvedPositions" | "showFullNodeDetail" | "handleImprentaNodeHover" | "actionNodeIds" | "loadingRouteEdges"> & Pick<ReturnType<typeof useImprentaLayout>, "NODE_W" | "ROW_H" | "getLayoutPositions"> & Pick<ReturnType<typeof useImprentaDragging>, "handleCanvasNodePointerDown" | "handleNodeMouseDown"> & Pick<ReturnType<typeof useImprentaNodeActions>, "handleCreateChild"> & Pick<ReturnType<typeof useImprentaConnections>, "handleConnectionCancel" | "handleUpdateContextType" | "handleDeleteContext"> & Pick<ReturnType<typeof useImprentaMedia>, "renderMediaWithZoom"> & { activeInstanceId?: string }

export function ImprentaPanelView({
  sidebarWidth, isImprentaLoading, setSelectedContextId,
  fileInputRef, handleFileChange, nodes,
  viewportStore, maxBounds, canvasNodes,
  stablePositions, dragStore, nodeHeightsSnapshot,
  NODE_W, ROW_H, parentEdgeStroke,
  hoverStore, parentEdgeHoverStroke, isLargeGraph,
  thumbCache, isDarkMode, mountedNodeIds,
  canvasGetImages, canvasGetVideos, handleCanvasNodePointerDown,
  tempConnection, draggingNodeId, connectionStore,
  dummyNodes, getLayoutPositions, nodeHeightsRef,
  setPositions, setNodes, supabase,
  handleCreateChild, isUploadingAsset, handleConnectionCancel,
  setSelectedContextAnchor, contexts, nodesRef,
  positions, selectedContextId, visibleNodeIds,
  resolveNodePosition, nodesById, selectedContextAnchor,
  handleUpdateContextType, handleDeleteContext, slicedRenderNodes,
  resolvedPositions, generatingNodeIds, showFullNodeDetail,
  registerNodeRef, handleNodeMouseDown, viewportInfo,
  handleImprentaNodeHover, actionNodeIds, logs,
  currentSite, textParams, imageParams,
  videoParams, audioParams, renderMediaWithZoom,
  actionsRef, loadingRouteEdges, zoomedMedia,
  setZoomedMedia, activeInstanceId,
}: ImprentaPanelViewOptions) {
  return (
    <div
      className="h-full min-h-0 flex flex-col transition-[margin-left,width] duration-300 ease-out relative"
      style={{
        marginLeft: `-${sidebarWidth}px`,
        width: `calc(100% + ${sidebarWidth}px)`
      }}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {!activeInstanceId || isImprentaLoading ? (
          <ImprentaSkeleton />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-hidden relative flex flex-col z-0"
            onClick={() => setSelectedContextId(null)}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,video/*,audio/*,text/plain,application/pdf"
            />
            <ZoomableCanvas
              className="w-full min-h-0 flex-1"
              height="100%"
              minHeight="100%"
              dotSize="20px"
              dotColorLight="rgba(0, 0, 0, 0.2)"
              dotColorDark="rgba(255, 255, 255, 0.2)"
              fitOnChildrenChange={false}
              initialOffsetY={0}
              enableWheelPan={true}
              recenterDependency={`${activeInstanceId}:${nodes.length > 0 ? "ready" : "empty"}`}
              viewportStore={viewportStore}
              graphBounds={maxBounds}
              screenSpaceBehind={
                <ImprentaParentEdgesCanvas
                  nodes={canvasNodes}
                  positions={stablePositions}
                  dragStore={dragStore}
                  nodeHeights={nodeHeightsSnapshot}
                  nodeW={NODE_W}
                  rowH={ROW_H}
                  strokeStyle={parentEdgeStroke}
                  hoverStore={hoverStore}
                  hoverChainStroke={parentEdgeHoverStroke}
                  viewportStore={viewportStore}
                  // On small graphs we keep full bezier edges at every zoom; the
                  // straight-line LOD only pays off when many edges fit on screen.
                  straightLinesBelowScale={isLargeGraph ? IMPRENTA_LOD_FULL_DETAIL_SCALE : 0}
                  markerMax={IMPRENTA_LOD_LITE_MARKER_MAX}
                />
              }
              screenSpaceFront={
                <>
                  <ImprentaNodesCanvas
                    nodes={canvasNodes}
                    positions={stablePositions}
                    heights={nodeHeightsSnapshot}
                    nodeW={NODE_W}
                    rowH={ROW_H}
                    // Effectively disable the lite canvas for small graphs by giving
                    // it an unreachable threshold — it stays mounted (no layer
                    // thrash on count crossings) but bails out of every paint and
                    // hit test, so DOM cards render at every zoom.
                    fullDetailScale={isLargeGraph ? IMPRENTA_LOD_FULL_DETAIL_SCALE : 0}
                    liteMarkerMax={IMPRENTA_LOD_LITE_MARKER_MAX}
                    liteMicroMax={IMPRENTA_LOD_LITE_MICRO_MAX}
                    liteSimpleMax={IMPRENTA_LOD_LITE_SIMPLE_MAX}
                    viewportStore={viewportStore}
                    thumbs={thumbCache}
                    isDarkMode={isDarkMode}
                    skipIds={mountedNodeIds}
                    getImageUrls={canvasGetImages}
                    getVideoUrls={canvasGetVideos}
                    onNodePointerDown={handleCanvasNodePointerDown}
                    pointerEventsEnabled={tempConnection == null && draggingNodeId == null}
                  />
                  <ImprentaTempConnectionCanvas
                    connectionStore={connectionStore}
                    viewportStore={viewportStore}
                    positions={stablePositions}
                    nodeHeights={nodeHeightsSnapshot}
                    nodeW={NODE_W}
                    rowH={ROW_H}
                    strokeStyle={isDarkMode ? "hsl(0, 0%, 100%)" : "hsl(0, 0%, 0%)"}
                  />
                </>
              }
              onSort={() => {
                toast.info("Organizing layout...");
                const allNodes = [...nodes, ...dummyNodes];
                const newPositions = getLayoutPositions(allNodes, {}, nodeHeightsRef.current);
                setPositions(newPositions);

                // Optimistically update nodes state
                setNodes(prev => prev.map(n => {
                  const pos = newPositions[n.id];
                  if (pos) {
                    return { ...n, settings: { ...((n.settings) || {}), ui_position: pos } };
                  }
                  return n;
                }));

                // Persist to DB in background
                const updates = nodes.map(n => {
                  const pos = newPositions[n.id];
                  if (pos) {
                    const updatedSettings = { ...((n.settings) || {}), ui_position: pos };
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
                  <TooltipProvider delayDuration={200}>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-medium px-2.5"
                            onClick={() => handleCreateChild(null)}
                            disabled={isUploadingAsset}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> New action
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          <span className="flex items-center gap-2">
                            New action
                            <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">Shift N</kbd>
                          </span>
                        </TooltipContent>
                      </Tooltip>
                      <div className="w-px h-4 bg-border mx-1"></div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-medium px-2.5"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAsset}
                          >
                            <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> {isUploadingAsset ? "Uploading..." : "New file"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          <span className="flex items-center gap-2">
                            Upload file
                            <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">Shift U</kbd>
                          </span>
                        </TooltipContent>
                      </Tooltip>
                      {tempConnection && (
                        <>
                          <div className="w-px h-4 bg-border mx-1"></div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs font-medium px-2.5"
                                onClick={handleConnectionCancel}
                              >
                                <X className="w-3.5 h-3.5 mr-1.5" /> Cancel connection
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={6}>
                              <span className="flex items-center gap-2">
                                Stop connecting node
                                <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">ESC</kbd>
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TooltipProvider>
                ) : null
              }
            >
              <div
                id="imprenta-canvas-content"
                className="relative"
                data-imprenta-connecting={tempConnection ? "true" : undefined}
                onClick={() => {
                  setSelectedContextId(null)
                  setSelectedContextAnchor(null)
                }}
              >
                {/* Parent edges are drawn by the viewport-sized canvas mounted in screenSpaceBehind. */}

                {/* Context edges: single SVG for all paths; labels/UI stay in per-context overlays. */}
                <ImprentaContextEdges
                  contexts={contexts}
                  nodesRef={nodesRef}
                  positions={positions}
                  nodeHeightsRef={nodeHeightsRef}
                  selectedContextId={selectedContextId}
                  onSelectContext={(id, anchor) => {
                    setSelectedContextId(id)
                    setSelectedContextAnchor(anchor || null)
                  }}
                  hoverStore={hoverStore}
                />

                {contexts.filter(ctx => !visibleNodeIds || visibleNodeIds.has(ctx.context_node_id) || visibleNodeIds.has(ctx.target_node_id)).map((ctx) => {
                  if (!positions[ctx.context_node_id] || !positions[ctx.target_node_id]) return null
                  const start = resolveNodePosition(ctx.context_node_id)
                  const end = resolveNodePosition(ctx.target_node_id)
                  const startCy = (nodeHeightsRef.current[ctx.context_node_id] || ROW_H) / 2
                  const targetNodeForCtx = nodesById.get(ctx.target_node_id)
                  const endH = nodeHeightsRef.current[ctx.target_node_id] || ROW_H
                  const endCy = getPublishContextAnchorY(targetNodeForCtx?.type, ctx.type, endH)
                  const startX = start.x + NODE_W
                  const startY = start.y + startCy
                  const endX = end.x
                  const endY = end.y + endCy
                  const midX = (startX + endX) / 2
                  const midY = (startY + endY) / 2
                  const isSelected = selectedContextId === ctx.id
                  // Context links feeding a node that already produced a result are
                  // locked: the action has run, so unlinking its inputs would rewrite
                  // history. Only links to actions (no result yet) are deletable.
                  const targetHasResult = !!targetNodeForCtx && imprentaNodeHasResult(targetNodeForCtx)

                  return (
                    <div
                      key={`ctx-wrapper-${ctx.id}`}
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ zIndex: isSelected ? 30 : 0 }}
                    >
                      {!isSelected && (ctx.type != null || targetNodeForCtx?.type === "publish") && (
                        <div
                          className="absolute px-2 py-0.5 bg-background border border-primary/20 text-primary text-[10px] font-medium rounded-full shadow-sm pointer-events-auto cursor-pointer whitespace-nowrap"
                          style={{
                            left: midX,
                            top: midY,
                            transform: "translate(-50%, -50%)",
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedContextId(ctx.id)
                            setSelectedContextAnchor({ x: e.clientX, y: e.clientY })
                          }}
                        >
                          {getPublishContextEdgeCaption(targetNodeForCtx?.type, ctx.type)}
                        </div>
                      )}

                      {isSelected && selectedContextAnchor && (
                        <ScreenAnchoredPanel anchor={selectedContextAnchor}>
                          <Card
                            className="pointer-events-auto z-50 flex items-center gap-1 border-primary/30 p-1 shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ImprentaContextTypeSelect
                              value={ctx.type || "reference"}
                              onValueChange={(val) => handleUpdateContextType(ctx.id, val)}
                            />

                            {!targetHasResult && (
                              <>
                                <div className="mx-1 h-4 w-px bg-border" />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleDeleteContext(ctx.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </Card>
                        </ScreenAnchoredPanel>
                      )}
                    </div>
                  )
                })}

                {/* Draw nodes (virtualized + LOD when graph is large). */}
                <TooltipProvider delayDuration={200}>
                  {slicedRenderNodes.map(node => {
                    const pos = resolvedPositions[node.id] || FALLBACK_POS
                    const isDummy = node.id.startsWith('dummy-');
                    const hasResult = node.result && Object.keys(node.result).length > 0;
                    const isEffectivelyDummy = isDummy || (!hasResult && generatingNodeIds.has(node.id) && (node.status === 'running' || node.status === 'pending'));

                    if (isEffectivelyDummy) {
                      /** Below full-detail zoom, strip expensive composites from the dummy card (animate-pulse gradient, etc). */
                      const liteDummy = !showFullNodeDetail

                      return (
                        <ImprentaDummyCardInner
                          key={node.id}
                          node={node}
                          pos={pos}
                          draggingNodeId={draggingNodeId}
                          liteDummy={liteDummy}
                          registerNodeRef={registerNodeRef}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        />
                      )
                    }

                    if (!showFullNodeDetail) {
                      const measured = nodeHeightsSnapshot[node.id]
                      const estimated = estimateImprentaNodeContentHeight(node, ROW_H)
                      const shellH = Math.round(
                        measured != null && measured >= ROW_H * 0.75
                          ? measured
                          : Math.max(measured ?? 0, estimated, ROW_H)
                      )
                      return (
                        <ImprentaLiteGraphNode
                          key={node.id}
                          node={node}
                          pos={pos}
                          width={NODE_W}
                          height={shellH}
                          zoomScale={viewportInfo?.scale ?? (IMPRENTA_LOD_LITE_MICRO_MAX + IMPRENTA_LOD_LITE_SIMPLE_MAX) / 2}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          registerRef={(el) => registerNodeRef(node.id, el, false)}
                          onHoverChange={handleImprentaNodeHover}
                        />
                      )
                    }

                    return (
                      <ImprentaNodeCardInner
                        key={node.id}
                        node={node}
                        pos={pos}
                        draggingNodeId={draggingNodeId}
                        hasResult={hasResult}
                        actionRunning={actionNodeIds.has(node.id)}
                        hasCnt={
                          node.type === "publish"
                            ? hasPublishContentInput(contexts, node.id, [...nodes, ...dummyNodes])
                            : false
                        }
                        hasAud={
                          node.type === "publish"
                            ? hasPublishAudienceInput(contexts, node.id, [...nodes, ...dummyNodes], logs)
                            : false
                        }
                        needAudience={
                          node.type === "publish"
                            ? destinationsRequireAudience(Array.isArray((node.settings)?.publish_destinations) ? (node.settings).publish_destinations as string[] : [])
                            : false
                        }
                        registerNodeRef={registerNodeRef}
                        nodes={nodes}
                        dummyNodes={dummyNodes}
                        contexts={contexts}
                        logs={logs}
                        supabase={supabase}
                        generatingNodeIds={generatingNodeIds}
                        currentSite={currentSite}
                        textParams={textParams}
                        imageParams={imageParams}
                        videoParams={videoParams}
                        audioParams={audioParams}
                        renderMediaWithZoom={renderMediaWithZoom}
                        actions={actionsRef.current}
                      />
                    )
                  })}
                </TooltipProvider>

                <ImprentaLoadingRouteEdges
                  edges={loadingRouteEdges}
                  positions={positions}
                  nodeHeights={nodeHeightsSnapshot}
                  nodeW={NODE_W}
                  rowH={ROW_H}
                />
              </div>
            </ZoomableCanvas>
          </div>
        )}
      </div>
      {zoomedMedia && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setZoomedMedia(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex justify-center items-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setZoomedMedia(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            {zoomedMedia.type === 'image' && <img src={zoomedMedia.url} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />}
            {zoomedMedia.type === 'video' && <video src={zoomedMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
