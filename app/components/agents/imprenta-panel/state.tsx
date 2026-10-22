import type { ImprentaContext, ImprentaLog } from './data-types'
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { createClient } from "@/lib/supabase/client"
import { useImprentaData } from "@/app/hooks/useImprentaData"
import { useState, useRef, useMemo } from "react"
import { InstanceNode } from "@/app/types/instance-nodes"
import { ImprentaPersistenceBarrier } from "@/app/lib/imprenta-persistence-barrier"
import { createImprentaDragStore } from "@/app/lib/imprenta-drag-store"
import { createImprentaConnectionStore } from "@/app/lib/imprenta-connection-store"
import { createImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import { type ZoomableViewportInfo } from "../zoomable-canvas"
import { createViewportStore, type ViewportStore } from "@/app/lib/imprenta-viewport-store"
import { useImprentaUpload } from "@/app/hooks/use-imprenta-upload"
import { getImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"
import { ImageParameters, VideoParameters, AudioParameters, TextParameters } from "../../simple-messages-view/types"

type ImprentaPanelStateOptions = { activeInstanceId?: string }

export function useImprentaPanelState({ activeInstanceId }: ImprentaPanelStateOptions) {
  const { currentSite } = useSite()

  const { isLayoutCollapsed } = useLayout()

  const isMobile = useIsMobile()

  const sidebarWidth = isMobile ? 0 : isLayoutCollapsed ? 64 : 256;

  const supabase = createClient()

  const { imprentaData, isLoading: isImprentaLoading, refreshImprentaData, cacheUploadedNode, logs: dataLogs } = useImprentaData(
    activeInstanceId,
    currentSite?.id
  )

  const logs = dataLogs as ImprentaLog[]

  const [nodes, setNodes] = useState<InstanceNode[]>([])

  const [initialPrompt, setInitialPrompt] = useState("")

  const [zoomedMedia, setZoomedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null)

  const imprentaSyncedInstanceRef = useRef<string | null>(null)

  const deletedNodeIdsRef = useRef<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  const persistenceBarrier = useMemo(() => new ImprentaPersistenceBarrier(), [])

  const [dummyNodes, setDummyNodes] = useState<InstanceNode[]>([])

  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set())

  const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>({})

  const dragStore = useMemo(() => createImprentaDragStore(), [])

  const connectionStore = useMemo(() => createImprentaConnectionStore(), [])

  const hoverStore = useMemo(() => createImprentaHoverStore(), [])

  const nodeDragRafRef = useRef<number | null>(null)

  const connectionMoveRafRef = useRef<number | null>(null)

  const lastConnectionPointerRef = useRef<{ x: number; y: number } | null>(null)

  const lastNodeDragPosRef = useRef<{ x: number; y: number } | null>(null)

  const [viewportInfo, setViewportInfo] = useState<ZoomableViewportInfo | null>(null)

  const viewportStoreRef = useRef<ViewportStore | null>(null)

  const { isUploadingAsset, handleFileChange } = useImprentaUpload({
    instanceId: activeInstanceId,
    siteId: currentSite?.id,
    getViewport: () => viewportStoreRef.current?.get(),
    onUploaded: async (node) => {
      if (imprentaRequestedInstanceRef.current !== node.instance_id) return
      await cacheUploadedNode(node)
      if (imprentaRequestedInstanceRef.current !== node.instance_id) return
      setNodes(prev => prev.some(n => n.id === node.id) ? prev : [...prev, node])
    },
  })

  if (viewportStoreRef.current == null) {
    viewportStoreRef.current = createViewportStore()
  }

  const viewportStore = viewportStoreRef.current

  const thumbCache = useMemo(() => getImprentaThumbCache(), [])

  const [layoutEpoch, setLayoutEpoch] = useState(0)

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)

  const [contexts, setContexts] = useState<ImprentaContext[]>([])

  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)

  const [selectedContextAnchor, setSelectedContextAnchor] = useState<{ x: number; y: number } | null>(null)

  const [tempConnection, setTempConnection] = useState<{ fromNode: string } | null>(null)

  const drawingConnectionRef = useRef<{ fromNode: string, mouseStartX: number, mouseStartY: number, nodeStartX: number, nodeStartY: number } | null>(null)

  const handleConnectionCancelRef = useRef<() => void>(() => { })

  const draggingNodeRef = useRef<string | null>(null)

  const dragStartPosRef = useRef({ x: 0, y: 0 })

  const dragStartNodePosRef = useRef({ x: 0, y: 0 })

  const nodeDragMovedRef = useRef(false)

  const positionsRef = useRef<Record<string, { x: number, y: number }>>({})

  const nodesRef = useRef<InstanceNode[]>([])

  const nodeHeightsRef = useRef<Record<string, number>>({})

  const nodeElementsRef = useRef<Record<string, HTMLDivElement>>({})

  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const resizeObserverRafRef = useRef<number | null>(null)

  const [selectedMediaType, setSelectedMediaType] = useState<'text' | 'image' | 'video' | 'audio' | 'audience' | 'publish'>('text')

  const [textParams, setTextParams] = useState<TextParameters>({ expectedResults: 1, length: 'medium', styles: ['default'] })

  const [imageParams, setImageParams] = useState<ImageParameters>({ format: 'PNG', aspectRatio: '1:1', quality: 'hd', expectedResults: 1 })

  const [videoParams, setVideoParams] = useState<VideoParameters>({ aspectRatio: '16:9', resolution: '720p', duration: 4, expectedResults: 1 })

  const [audioParams, setAudioParams] = useState<AudioParameters>({ format: 'MP3', expectedResults: 1 })

  const imprentaRequestedInstanceRef = useRef<string | null>(null)

  return {
    currentSite,
    isLayoutCollapsed,
    isMobile,
    sidebarWidth,
    supabase,
    imprentaData,
    isImprentaLoading,
    refreshImprentaData,
    cacheUploadedNode,
    logs,
    nodes,
    setNodes,
    initialPrompt,
    setInitialPrompt,
    zoomedMedia,
    setZoomedMedia,
    imprentaSyncedInstanceRef,
    deletedNodeIdsRef,
    fileInputRef,
    persistenceBarrier,
    dummyNodes,
    setDummyNodes,
    generatingNodeIds,
    setGeneratingNodeIds,
    positions,
    setPositions,
    dragStore,
    connectionStore,
    hoverStore,
    nodeDragRafRef,
    connectionMoveRafRef,
    lastConnectionPointerRef,
    lastNodeDragPosRef,
    viewportInfo,
    setViewportInfo,
    viewportStoreRef,
    isUploadingAsset,
    handleFileChange,
    viewportStore,
    thumbCache,
    layoutEpoch,
    setLayoutEpoch,
    draggingNodeId,
    setDraggingNodeId,
    contexts,
    setContexts,
    selectedContextId,
    setSelectedContextId,
    selectedContextAnchor,
    setSelectedContextAnchor,
    tempConnection,
    setTempConnection,
    drawingConnectionRef,
    handleConnectionCancelRef,
    draggingNodeRef,
    dragStartPosRef,
    dragStartNodePosRef,
    nodeDragMovedRef,
    positionsRef,
    nodesRef,
    nodeHeightsRef,
    nodeElementsRef,
    resizeObserverRef,
    resizeObserverRafRef,
    selectedMediaType,
    setSelectedMediaType,
    textParams,
    setTextParams,
    imageParams,
    setImageParams,
    videoParams,
    setVideoParams,
    audioParams,
    setAudioParams,
    imprentaRequestedInstanceRef,
  }
}
