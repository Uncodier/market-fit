import { useState, useEffect, useRef, useCallback } from "react"
import type { ZoomableCanvasProps, ZoomableViewportInfo } from "./zoomable-canvas-types"
export function useCanvasState({recenterDependency, onViewportTransformChange, viewportStore, enableWheelPan}: ZoomableCanvasProps, isLayoutCollapsed: boolean) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  /** Refs avoid setState on every pointer move (critical for Safari drag performance). */
  const isDraggingRef = useRef(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const startDragPositionRef = useRef({ x: 0, y: 0 });
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastMousePosRef = useRef<{ x: number, y: number } | null>(null);
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false); // Track user interaction
  const [autoRecenterEnabled, setAutoRecenterEnabled] = useState(true); // Control if auto-recenter is enabled
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartScale, setTouchStartScale] = useState<number>(1);
  const prevRecenterDepRef = useRef(recenterDependency);
  const prevLayoutCollapsedRef = useRef(isLayoutCollapsed);
  const singleFingerPanRef = useRef(false);

  const onViewportTransformChangeRef = useRef(onViewportTransformChange);
  onViewportTransformChangeRef.current = onViewportTransformChange;
  const viewportStoreRef = useRef(viewportStore);
  viewportStoreRef.current = viewportStore;
  const viewportNotifyRafRef = useRef<number | null>(null);

  const flushViewportNotify = useCallback(() => {
    viewportNotifyRafRef.current = null;
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();

    if (r.width < 2 || r.height < 2) {
      viewportNotifyRafRef.current = requestAnimationFrame(flushViewportNotify);
      return;
    }

    const info: ZoomableViewportInfo = {
      scale: scaleRef.current,
      position: { ...positionRef.current },
      canvasWidth: r.width,
      canvasHeight: r.height,
    };
    const store = viewportStoreRef.current;
    if (store) {
      store.set(info);
    }
    const cb = onViewportTransformChangeRef.current;
    if (cb) cb(info);
  }, []);

  const scheduleViewportNotify = useCallback(() => {
    if (!onViewportTransformChangeRef.current && !viewportStoreRef.current) return;
    if (viewportNotifyRafRef.current != null) return;
    viewportNotifyRafRef.current = requestAnimationFrame(flushViewportNotify);
  }, [flushViewportNotify]);

  useEffect(() => {
    return () => {
      if (viewportNotifyRafRef.current != null) {
        cancelAnimationFrame(viewportNotifyRafRef.current);
        viewportNotifyRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    if (!isInitialized) return;
    if (!onViewportTransformChangeRef.current && !viewportStoreRef.current) return;
    flushViewportNotify();
  }, [isInitialized, scale, position, flushViewportNotify]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.pointerEvents = isUserInteracting ? "none" : "";
    }
    const store = viewportStoreRef.current;
    if (!store) return;
    store.setInteracting(isUserInteracting);
  }, [isUserInteracting]);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const enableWheelPanRef = useRef(enableWheelPan);
  enableWheelPanRef.current = enableWheelPan;
  const applyBackgroundTransformRef = useRef<(x: number, y: number, s: number) => void>(() => {});
  const commitTransform = useCallback((x: number, y: number, s: number) => {
    positionRef.current = { x, y };
    scaleRef.current = s;
    if (contentRef.current) contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    applyBackgroundTransformRef.current(x, y, s);
    setPosition({ x, y });
    setScale(s);
    scheduleViewportNotify();
  }, [scheduleViewportNotify]);
return { scale, setScale, position, setPosition, isDragging, setIsDragging, isDraggingRef, positionRef, scaleRef, startDragPositionRef, isZoomedIn, setIsZoomedIn, canvasRef, wrapperRef, contentRef, lastMousePosRef, contentDimensions, setContentDimensions, isInitialized, setIsInitialized, isUserInteracting, setIsUserInteracting, autoRecenterEnabled, setAutoRecenterEnabled, touchStartDistance, setTouchStartDistance, touchStartScale, setTouchStartScale, prevRecenterDepRef, prevLayoutCollapsedRef, singleFingerPanRef, onViewportTransformChangeRef, viewportStoreRef, scheduleViewportNotify, enableWheelPanRef, applyBackgroundTransformRef, commitTransform };
}
export type CanvasState = ReturnType<typeof useCanvasState>
