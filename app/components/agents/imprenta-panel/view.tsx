import { ImprentaSkeleton } from "@/app/components/skeletons/imprenta-skeleton"
import { ZoomableCanvas } from "../zoomable-canvas"
import { ImprentaParentEdgesCanvas } from "../imprenta-parent-edges-canvas"
import { ImprentaNodesCanvas } from "../imprenta-nodes-canvas"
import { ImprentaTempConnectionCanvas } from "../imprenta-temp-connection-canvas"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Button } from "@/app/components/ui/button"
import { Plus, UploadCloud, X } from "@/app/components/ui/icons"
import { ImprentaContextEdgesCanvas } from "../imprenta-context-edges-canvas"
import { ImprentaNodePicker } from './node-picker'
import { destinationsRequireAudience, hasPublishAudienceInput, hasPublishContentInput } from "@/app/components/agents/imprenta-publish-context"
import { ImprentaLoadingRouteEdges } from "../imprenta-world-svg"
import { createPortal } from "react-dom"
import { IMPRENTA_LOD_FULL_DETAIL_SCALE, IMPRENTA_LOD_LITE_MARKER_MAX, IMPRENTA_LOD_LITE_MICRO_MAX, IMPRENTA_LOD_LITE_SIMPLE_MAX, FALLBACK_POS, estimateImprentaNodeContentHeight } from './preview-helpers'
import { ImprentaContextControls } from './context-controls'
import { ImprentaDummyCardInner } from './dummy-card'
import { ImprentaLiteGraphNode } from './lite-node'
import { ImprentaNodeCardInner } from './node-card'
import { useImprentaCardData } from './card-data'
import { ImprentaDataNotice } from './data-notice'
import type { useImprentaPanelState } from './state'
import type { useImprentaLayoutEffects } from './layout-effects'
import type { useImprentaMeasurement } from './measurement'
import type { useImprentaVirtualization } from './virtualization'
import type { useImprentaLayout } from "./graph-layout"
import type { useImprentaDragging } from './drag'
import type { useImprentaNodeActions } from './node-actions'
import type { useImprentaConnections } from './connections'
import type { useImprentaMedia } from './media'
import type { useImprentaSynchronization } from './sync'

type ImprentaPanelViewOptions = Pick<ReturnType<typeof useImprentaPanelState>, "sidebarWidth" | "isImprentaLoading" | "setSelectedContextId" | "fileInputRef" | "handleFileChange" | "nodes" | "viewportStore" | "dragStore" | "hoverStore" | "thumbCache" | "tempConnection" | "draggingNodeId" | "connectionStore" | "dummyNodes" | "nodeHeightsRef" | "setPositions" | "setNodes" | "supabase" | "isUploadingAsset" | "setSelectedContextAnchor" | "contexts" | "nodesRef" | "positions" | "selectedContextId" | "selectedContextAnchor" | "generatingNodeIds" | "viewportInfo" | "logs" | "currentSite" | "textParams" | "imageParams" | "videoParams" | "audioParams" | "zoomedMedia" | "setZoomedMedia"> & Pick<ReturnType<typeof useImprentaLayoutEffects>, "maxBounds" | "actions"> & Pick<ReturnType<typeof useImprentaMeasurement>, "canvasNodes" | "isDarkMode" | "registerNodeRef"> & Pick<ReturnType<typeof useImprentaVirtualization>, "stablePositions" | "nodeHeightsSnapshot" | "parentEdgeStroke" | "parentEdgeHoverStroke" | "isLargeGraph" | "mountedNodeIds" | "canvasGetImages" | "canvasGetVideos" | "visibleNodeIds" | "resolveNodePosition" | "nodesById" | "slicedRenderNodes" | "resolvedPositions" | "showFullNodeDetail" | "handleImprentaNodeHover" | "actionNodeIds" | "loadingRouteEdges"> & Pick<ReturnType<typeof useImprentaLayout>, "NODE_W" | "ROW_H" | "getLayoutPositions"> & Pick<ReturnType<typeof useImprentaDragging>, "handleCanvasNodePointerDown" | "handleNodeMouseDown"> & Pick<ReturnType<typeof useImprentaNodeActions>, "handleCreateChild"> & Pick<ReturnType<typeof useImprentaConnections>, "handleConnectionCancel" | "handleUpdateContextType" | "handleDeleteContext"> & Pick<ReturnType<typeof useImprentaMedia>, "renderMediaWithZoom"> & { activeInstanceId?: string }

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
  setSelectedContextAnchor, contexts,
  positions, selectedContextId, visibleNodeIds,
  nodesById, selectedContextAnchor,
  handleUpdateContextType, handleDeleteContext, slicedRenderNodes,
  resolvedPositions, generatingNodeIds, showFullNodeDetail,
  registerNodeRef, handleNodeMouseDown, viewportInfo,
  handleImprentaNodeHover, actionNodeIds, logs,
  currentSite, textParams, imageParams,
  videoParams, audioParams, renderMediaWithZoom,
  actions, loadingRouteEdges, zoomedMedia,
  setZoomedMedia, activeInstanceId, graphError, logsError, retryImprentaData,
  activeEditorNodeId, focusedEditorNodeId, activateEditor, promptDrafts,
}: ImprentaPanelViewOptions & Pick<ReturnType<typeof useImprentaPanelState>, "graphError" | "logsError" | "activeEditorNodeId" | "focusedEditorNodeId" | "activateEditor" | "promptDrafts"> & ReturnType<typeof useImprentaSynchronization>) {
  const getCardData = useImprentaCardData(nodes, dummyNodes, contexts, logs)
  const openEditor = (id: string) => {
    activateEditor(id)
    const pos = resolvedPositions[id]
    const viewport = viewportStore.get()
    viewportStore.requestFocus?.({ x: pos ? pos.x + NODE_W / 2 : (viewport.canvasWidth / 2 - viewport.position.x) / viewport.scale,
      y: pos ? pos.y + (nodeHeightsSnapshot[id] || ROW_H) / 2 : (viewport.canvasHeight / 2 - viewport.position.y) / viewport.scale,
      scale: Math.max(0.7, viewport.scale) })
  }
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
                <>
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
                <ImprentaContextEdgesCanvas contexts={contexts} nodes={canvasNodes} positions={stablePositions}
                  nodeHeights={nodeHeightsSnapshot} viewportStore={viewportStore} dragStore={dragStore}
                  hoverStore={hoverStore} selectedContextId={selectedContextId} isDarkMode={isDarkMode}
                  onSelectContext={(id, anchor) => { setSelectedContextId(id); setSelectedContextAnchor(anchor || null) }} />
                </>
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
                    renderAtAllScales={isLargeGraph}
                    liteMarkerMax={IMPRENTA_LOD_LITE_MARKER_MAX}
                    liteMicroMax={IMPRENTA_LOD_LITE_MICRO_MAX}
                    liteSimpleMax={IMPRENTA_LOD_LITE_SIMPLE_MAX}
                    viewportStore={viewportStore}
                    thumbs={thumbCache}
                    isDarkMode={isDarkMode}
                    skipIds={mountedNodeIds}
                    selectedId={activeEditorNodeId}
                    getImageUrls={canvasGetImages}
                    getVideoUrls={canvasGetVideos}
                    onNodePointerDown={(id, event) => {
                      if (tempConnection) {
                        event.preventDefault(); event.stopPropagation()
                        if (nodesById.get(id)?.type === 'publish') openEditor(id)
                        else void actions.handleConnectionDrop(event, id)
                      } else handleCanvasNodePointerDown(id, event)
                    }}
                    pointerEventsEnabled={draggingNodeId == null}
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
                      {isLargeGraph && <ImprentaNodePicker nodes={nodes} onSelect={openEditor} />}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-medium px-2.5"
                            onClick={async () => { const id = await handleCreateChild(null); if (id && isLargeGraph) openEditor(id) }}
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

                <ImprentaContextControls contexts={contexts} positions={positions} nodeHeights={nodeHeightsSnapshot}
                  nodesById={nodesById} visibleNodeIds={visibleNodeIds} showLabels={showFullNodeDetail}
                  selectedId={selectedContextId} anchor={selectedContextAnchor} nodeW={NODE_W} rowH={ROW_H}
                  onSelect={(id, anchor) => { setSelectedContextId(id); setSelectedContextAnchor(anchor) }}
                  onChange={handleUpdateContextType} onDelete={handleDeleteContext} />

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

                    if (!showFullNodeDetail && activeEditorNodeId !== node.id && focusedEditorNodeId !== node.id) {
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
                        isDragging={draggingNodeId === node.id}
                        isGenerating={generatingNodeIds.has(node.id)}
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
                        {...getCardData(node)}
                        supabase={supabase}
                        currentSite={currentSite}
                        textParams={textParams}
                        imageParams={imageParams}
                        videoParams={videoParams}
                        audioParams={audioParams}
                        renderMediaWithZoom={renderMediaWithZoom}
                        actions={actions}
                        promptDrafts={promptDrafts}
                        isActiveEditor={isLargeGraph && activeEditorNodeId === node.id}
                        onCloseEditor={() => activateEditor(null)}
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
      <ImprentaDataNotice key={activeInstanceId} graphError={graphError} logsError={logsError} onRetry={retryImprentaData} />
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
            {zoomedMedia.type === 'image' && <img src={zoomedMedia.url} alt="Generated media preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />}
            {zoomedMedia.type === 'video' && <video src={zoomedMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
