import type React from "react"
import type { ViewportStore } from "@/app/lib/imprenta-viewport-store"
/** Canvas pan/zoom in screen space; use with worldViewportFromCanvas for graph culling. */
export type ZoomableViewportInfo = {
  scale: number
  position: { x: number; y: number }
  canvasWidth: number
  canvasHeight: number
}

export interface ZoomableCanvasProps {
  children: React.ReactNode
  className?: string
  recenterDependency?: any
  dotColorLight?: string
  dotColorDark?: string
  dotSize?: string
  dotRadius?: string
  fitOnChildrenChange?: boolean
  extraControls?: React.ReactNode
  onSort?: () => void
  height?: string
  minHeight?: string
  initialOffsetY?: number
  /**
   * Measure the content layer as filling the viewport (100% × 100%) so fit/center math does not
   * apply a large translate to center a tight shrink-wrapped box. Pair with `graphBounds` for scale.
   */
  measureAsViewportFill?: boolean
  /** Intrinsic size of the graph/artboard (e.g. node bounding box) for fit scale when using viewport fill. */
  graphBounds?: { width: number; height: number; offsetX?: number; offsetY?: number } | null
  /** Fired when pan/zoom changes (throttled to rAF during drag). For viewport virtualization. */
  onViewportTransformChange?: (info: ZoomableViewportInfo) => void
  /**
   * Optional external store so sibling canvases (edges, nodes) can subscribe to transform
   * changes without re-rendering the React tree. Writes occur on the same rAF boundary
   * as `onViewportTransformChange`.
   */
  viewportStore?: ViewportStore
  /**
   * Rendered in the canvas container at screen space, above the background and below the
   * transformed content. Canvases that do their own world-to-screen mapping go here so
   * they stay viewport-sized (bitmap O(screen) instead of O(world)).
   */
  screenSpaceBehind?: React.ReactNode
  /**
   * Rendered at screen space *above* the transformed content. For overlays that must not
   * be occluded by DOM nodes.
   */
  screenSpaceFront?: React.ReactNode
  /**
   * When true, a plain mouse/trackpad wheel pans the canvas (vertical + horizontal),
   * while Ctrl/Cmd+wheel still zooms. Shift+wheel pans horizontally on mice without an
   * X-axis wheel. Off by default so other views keep page-scroll behaviour.
   */
  enableWheelPan?: boolean
}
