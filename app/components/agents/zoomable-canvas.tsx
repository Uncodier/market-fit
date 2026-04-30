import React, { useState, useEffect, useRef, useCallback } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { Button } from "@/app/components/ui/button"
import { ZoomIn, ZoomOut, Maximize, LayoutGrid } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import debounce from "lodash/debounce"
import { useTheme } from "@/app/context/ThemeContext"
import type { ViewportStore } from "@/app/lib/imprenta-viewport-store"

/**
 * Returns true when the event target is an editable field, so canvas
 * shortcuts don't hijack typing.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return false
}

/** Canvas pan/zoom in screen space; use with worldViewportFromCanvas for graph culling. */
export type ZoomableViewportInfo = {
  scale: number
  position: { x: number; y: number }
  canvasWidth: number
  canvasHeight: number
}

interface ZoomableCanvasProps {
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
  graphBounds?: { width: number; height: number } | null
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
}

/** Square 1:1 keycap for shortcut hints inside tooltips. */
const tooltipKbdClass =
  "pointer-events-none inline-flex h-4 w-4 items-center justify-center rounded border bg-muted font-mono text-[10px] font-medium leading-none text-muted-foreground"

export function ZoomableCanvas({ 
  children, 
  className,
  recenterDependency,
  dotColorLight = 'rgba(0, 0, 0, 0.07)',
  dotColorDark = 'rgba(255, 255, 255, 0.07)',
  dotSize = '24px',
  dotRadius = '1px',
  fitOnChildrenChange = true,
  extraControls,
  onSort,
  height = "calc(100vh - 135px)",
  minHeight = "600px",
  initialOffsetY = 0,
  measureAsViewportFill = false,
  graphBounds = null,
  onViewportTransformChange,
  viewportStore,
  screenSpaceBehind,
  screenSpaceFront,
}: ZoomableCanvasProps) {
  // Use the layout context to get the current state
  const { isLayoutCollapsed } = useLayout();
  // Use theme context to detect changes
  const { isDarkMode } = useTheme();
  
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
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false); // Track user interaction
  const [autoRecenterEnabled, setAutoRecenterEnabled] = useState(true); // Control if auto-recenter is enabled
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartScale, setTouchStartScale] = useState<number>(1);
  const prevRecenterDepRef = useRef(recenterDependency);
  const prevLayoutCollapsedRef = useRef(isLayoutCollapsed);

  // Variables for animation
  const animationRef = useRef<number | null>(null);
  const targetPositionRef = useRef({ x: 0, y: 0, scale: 1 });
  const currentPositionRef = useRef({ x: 0, y: 0, scale: 1 });
  const isAnimatingRef = useRef(false);
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
    if (!isInitialized) return;
    if (!onViewportTransformChangeRef.current && !viewportStoreRef.current) return;
    flushViewportNotify();
  }, [isInitialized, scale, position, flushViewportNotify]);

  useEffect(() => {
    const store = viewportStoreRef.current;
    if (!store) return;
    store.setInteracting(isUserInteracting);
  }, [isUserInteracting]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const measureAsViewportFillRef = useRef(measureAsViewportFill);
  measureAsViewportFillRef.current = measureAsViewportFill;
  const graphBoundsRef = useRef(graphBounds);
  graphBoundsRef.current = graphBounds;

  // Measure content size without transformations - optimized to avoid loops
  const measureContent = useCallback(() => {
    return new Promise<{width: number, height: number}>(resolve => {
      if (!contentRef.current) {
        resolve({width: 0, height: 0});
        return;
      }

      // Remember original styles before changing them
      const originalStyles = {
        transform: contentRef.current.style.transform,
        width: contentRef.current.style.width,
        height: contentRef.current.style.height,
        minWidth: contentRef.current.style.minWidth,
        minHeight: contentRef.current.style.minHeight,
        maxWidth: contentRef.current.style.maxWidth,
        maxHeight: contentRef.current.style.maxHeight,
        position: contentRef.current.style.position,
        display: contentRef.current.style.display,
        overflow: contentRef.current.style.overflow,
        paddingRight: contentRef.current.style.paddingRight
      };
      
      contentRef.current.style.transform = 'none';
      contentRef.current.style.paddingRight = '0';

      if (measureAsViewportFillRef.current) {
        // Match viewport: avoids shrink-wrap width driving a huge pan to "center" the artboard.
        contentRef.current.style.width = '100%';
        contentRef.current.style.height = '100%';
        contentRef.current.style.minWidth = '';
        contentRef.current.style.minHeight = '';
        contentRef.current.style.maxWidth = '';
        contentRef.current.style.maxHeight = '';
        contentRef.current.style.position = 'static';
        contentRef.current.style.display = 'block';
        contentRef.current.style.overflow = 'visible';
      } else {
        // Shrink-wrapped intrinsic size (workflow / agents views).
        contentRef.current.style.width = 'max-content';
        contentRef.current.style.minWidth = '';
        contentRef.current.style.position = 'static';
        contentRef.current.style.display = 'inline-block';
        contentRef.current.style.overflow = 'visible';
      }
      
      // Force browser to apply style changes
      void contentRef.current.offsetWidth;

      const width = contentRef.current.offsetWidth;
      const height = contentRef.current.offsetHeight;
      
      const dimensions = {
        width: width,
        height: height
      };
      
      // Restore all original styles in correct order
      Object.entries(originalStyles).forEach(([prop, value]) => {
        // @ts-ignore - dynamic property assignment
        contentRef.current!.style[prop] = value;
      });
      
      // Skip state update if unchanged (avoids re-render chains + memory churn on resize)
      setContentDimensions((prev) =>
        prev.width === dimensions.width && prev.height === dimensions.height
          ? prev
          : dimensions
      );
      
      // Return the dimensions
      resolve(dimensions);
    });
  }, []);

  // Calculate optimal transformation (fit/contain)
  const calculateContainTransform = useCallback(async () => {
    if (!canvasRef.current) return { scale: 1, x: 0, y: 0 };
    
    // If content dimensions are unknown, measure them
    let contentSize = contentDimensions;
    if (contentSize.width === 0 || contentSize.height === 0) {
      contentSize = await measureContent();
    }
    
    // If still 0, something failed
    if (contentSize.width === 0 || contentSize.height === 0) {
      return { scale: 1, x: 0, y: 0 };
    }
    
    // We need accurate measurements of our visible area
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // The effective available width is the canvas container's width
    const availableWidth = canvasRect.width;
    const availableHeight = canvasRect.height;

    // WebKit often reports 0×0 on the first layout pass inside nested flex + absolute
    // trees. Using that in Math.min yields scale(0), which hides all nodes.
    if (availableWidth < 2 || availableHeight < 2) {
      return { scale: 1, x: 0, y: 0 };
    }
    
    const margin = 0.02;

    // Viewport-fill + CSS-centered artboard: keep pan at origin; scale from graph intrinsic bounds only.
    if (measureAsViewportFillRef.current) {
      const gb = graphBoundsRef.current;
      if (gb && gb.width > 0 && gb.height > 0) {
        const scaleX = (availableWidth * (1 - margin)) / gb.width;
        const scaleY = (availableHeight * (1 - margin)) / gb.height;
        let newScale = Math.min(scaleX, scaleY, 1);
        if (!Number.isFinite(newScale) || newScale <= 0) {
          newScale = 1;
        }
        return { scale: newScale, x: 0, y: 0 };
      }
      return { scale: 1, x: 0, y: 0 };
    }

    const scaleX = (availableWidth * (1 - margin)) / contentSize.width;
    const scaleY = (availableHeight * (1 - margin)) / contentSize.height;
    
    let newScale = Math.min(Math.min(scaleX, scaleY), 0.95);
    if (!Number.isFinite(newScale) || newScale <= 0) {
      newScale = 1;
    }
    
    const contentWidth = contentSize.width * newScale;
    
    const canvasCenter = availableWidth / 2;
    const canvasCenterY = availableHeight / 2;
    
    const finalX = canvasCenter - (contentWidth / 2);
    const finalY = canvasCenterY - (contentSize.height * newScale / 2) + initialOffsetY;
    
    return { scale: newScale, x: finalX, y: finalY };
  }, [contentDimensions, measureContent, initialOffsetY]);

  // Helper function to animate to a position over time with RAF
  const animateToPosition = useCallback((targetX: number, targetY: number, targetScale: number, duration = 180) => {
    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Set the target values
    targetPositionRef.current = { 
      x: targetX, 
      y: targetY, 
      scale: targetScale 
    };
    
    // Store current values as starting point
    currentPositionRef.current = { 
      x: position.x, 
      y: position.y, 
      scale: scale 
    };
    
    // Skip animation if distance is very small
    const distanceX = Math.abs(targetX - position.x);
    const distanceY = Math.abs(targetY - position.y);
    const distanceScale = Math.abs(targetScale - scale);
    
    if (distanceX < 5 && distanceY < 5 && distanceScale < 0.05) {
      // Just set the values directly for very small changes
      setPosition({ x: targetX, y: targetY });
      setScale(targetScale);
      
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(${targetScale})`;
      }
      
      applyBackgroundTransformRef.current(targetX, targetY, targetScale);
      
      return;
    }
    
    // Flag that we're animating
    isAnimatingRef.current = true;
    
    // Animation start time
    const startTime = performance.now();
    
    // Animation function using RAF
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Exponential easing - faster initially and slowing down at the end
      // More aggressive than cubic for quicker perceived response
      const easedProgress = 1 - Math.pow(1 - progress, 2.5);
      
      // Calculate interpolated values
      const newX = currentPositionRef.current.x + 
        (targetPositionRef.current.x - currentPositionRef.current.x) * easedProgress;
      const newY = currentPositionRef.current.y + 
        (targetPositionRef.current.y - currentPositionRef.current.y) * easedProgress;
      const newScale = currentPositionRef.current.scale + 
        (targetPositionRef.current.scale - currentPositionRef.current.scale) * easedProgress;
      
      // Apply to DOM directly for smoother animation
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      
      applyBackgroundTransformRef.current(newX, newY, newScale);
      
      // Update state less frequently to avoid React re-renders
      // Only update state at beginning, middle and end for better performance
      if (progress === 0 || progress >= 1 || Math.abs(progress - 0.5) < 0.1) {
        setPosition({ x: newX, y: newY });
        setScale(newScale);
      }
      
      // Continue animation if not complete
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - ensure final values are set
        setPosition({ x: targetPositionRef.current.x, y: targetPositionRef.current.y });
        setScale(targetPositionRef.current.scale);
        
        // Mark animation as complete
        isAnimatingRef.current = false;
        animationRef.current = null;
      }
    };
    
    // Start animation
    animationRef.current = requestAnimationFrame(animate);
  }, [position, scale]);

  // Improved transform application function
  const applyTransform = useCallback((x: number, y: number, newScale: number, animate = false) => {
    if (animate) {
      // Use smooth animation
      animateToPosition(x, y, newScale);
    } else {
      // Immediate transform without animation
      setPosition({ x, y });
      setScale(newScale);
      
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.style.transition = 'opacity 0.2s ease-in';
          contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${newScale})`;
        }
        applyBackgroundTransformRef.current(x, y, newScale);
      });
    }
  }, [animateToPosition]);

  // Apply optimal transformation
  const applyContainTransform = useCallback(async () => {
    // Get transformation values
    const { scale: newScale, x: newX, y: newY } = await calculateContainTransform();
    
    // Apply transform directly to DOM
    if (contentRef.current) {
      contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
    }
    applyBackgroundTransformRef.current(newX, newY, newScale);
    
    // Update state
    setScale(newScale);
    setPosition({ x: newX, y: newY });
    setIsZoomedIn(false);
  }, [calculateContainTransform]);

  // Stable debounce + latest callbacks via refs. useCallback(debounce(...), [deps]) recreated
  // debounced functions on every dep change without cancelling the old ones → leaked closures
  // and queued work (Safari tab reloads under memory pressure).
  const measureContentRef = useRef(measureContent);
  measureContentRef.current = measureContent;
  const applyContainTransformRef = useRef(applyContainTransform);
  applyContainTransformRef.current = applyContainTransform;
  const interactionStateRef = useRef({
    isInitialized: false,
    isUserInteracting: false,
    autoRecenterEnabled: true,
  });
  interactionStateRef.current = { isInitialized, isUserInteracting, autoRecenterEnabled };

  const resizeDebounceRef = useRef<ReturnType<typeof debounce> | null>(null);
  if (resizeDebounceRef.current === null) {
    resizeDebounceRef.current = debounce(() => {
      const s = interactionStateRef.current;
      if (!s.isInitialized || s.isUserInteracting || !s.autoRecenterEnabled) return;
      void (async () => {
        try {
          await measureContentRef.current();
          await applyContainTransformRef.current();
        } catch (e) {
          console.error("ZoomableCanvas resize:", e);
        }
      })();
    }, 160);
  }

  useEffect(() => {
    return () => {
      resizeDebounceRef.current?.cancel();
    };
  }, []);

  // Measure content on mount
  useEffect(() => {
    if (!isInitialized) {
      // Use shorter timeout to avoid noticeable jump, just enough for DOM to render
      const timer = setTimeout(async () => {
        try {
          await measureContent();
          await applyContainTransform();
        } catch (e) {
          console.error("ZoomableCanvas initial layout failed:", e);
        } finally {
          setIsInitialized(true);
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialized, measureContent, applyContainTransform]);

  // Safari/WebKit: flex + absolute layout may settle after first paint; recentre when the
  // canvas viewport gains a non-zero size.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      resizeDebounceRef.current?.();
      scheduleViewportNotify();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleViewportNotify]);

  // Readjust when window size or menu state changes
  useEffect(() => {
    const onResize = () => resizeDebounceRef.current?.();
    window.addEventListener("resize", onResize);
    let timer: ReturnType<typeof setTimeout> | undefined;
    
    const layoutCollapsedChanged = prevLayoutCollapsedRef.current !== isLayoutCollapsed;
    prevLayoutCollapsedRef.current = isLayoutCollapsed;
    
    // Only recenter when sidebar actually collapsed/expanded, not on other dep changes
    if (layoutCollapsedChanged && isInitialized && !isUserInteracting && autoRecenterEnabled) {
      timer = setTimeout(() => {
        void applyContainTransform();
      }, 50);
    }
    
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, [isInitialized, isLayoutCollapsed, applyContainTransform, isUserInteracting, autoRecenterEnabled]);

  // Handle explicit recenter dependency
  useEffect(() => {
    if (isInitialized && recenterDependency !== prevRecenterDepRef.current) {
      prevRecenterDepRef.current = recenterDependency;
      
      // Force a recenter and re-enable auto recentering
      setAutoRecenterEnabled(true);
      
      // We might need to re-measure content if the layout drastically changed
      const timer = setTimeout(() => {
        applyContainTransform();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [recenterDependency, isInitialized, applyContainTransform]);

  // New effect to detect changes in children (like expanded cards)
  useEffect(() => {
    if (isInitialized && !isUserInteracting && autoRecenterEnabled && fitOnChildrenChange) {
      // Use a small delay to allow DOM to update after children change
      const timer = setTimeout(async () => {
        await measureContent();
        await applyContainTransform();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [children, isInitialized, measureContent, applyContainTransform, isUserInteracting, autoRecenterEnabled, fitOnChildrenChange]);

  // Reset view button: use same algorithm as initial load
  const resetView = useCallback(() => {
    // Enable auto-recenter so future window resizes will adjust properly
    setAutoRecenterEnabled(true);
    setIsUserInteracting(false);
    
    // Force a new measurement of content before applying transform
    measureContent().then(() => {
      calculateContainTransform().then(({ scale: newScale, x: newX, y: newY }) => {
        // Apply transform directly
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
        }
        applyBackgroundTransformRef.current(newX, newY, newScale);
        
        // Update state
        setScale(newScale);
        setPosition({ x: newX, y: newY });
        setIsZoomedIn(false);
      });
    });
  }, [measureContent, calculateContainTransform]);

  // Zoom in function
  const zoomIn = useCallback(() => {
    setIsUserInteracting(true);
    setAutoRecenterEnabled(false);
    
    const newScale = scale + 0.1;
    
    // Activate zoom state when above threshold
    if (newScale > 0.9) {
      setIsZoomedIn(true);
    }
    
    // Adjust position to maintain center
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // Calculate center point of visible canvas area
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      
      // Calculate new position maintaining the center point
      const scaleRatio = newScale / scale;
      const newX = centerX - (centerX - position.x) * scaleRatio;
      const newY = centerY - (centerY - position.y) * scaleRatio;
      
      // Apply directly to DOM for better performance
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      applyBackgroundTransformRef.current(newX, newY, newScale);
      
      // Update state
      setScale(newScale);
      setPosition({ x: newX, y: newY });
    }
  }, [position, scale]);

  // Zoom out function
  const zoomOut = useCallback(() => {
    setIsUserInteracting(true);
    setAutoRecenterEnabled(false);
    
    const newScale = Math.max(scale - 0.1, 0.3);
    
    // Deactivate zoom state when below threshold
    if (newScale <= 0.9) {
      setIsZoomedIn(false);
    }
    
    // Adjust position to maintain center
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // Calculate center point of visible canvas area
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      
      // Calculate new position maintaining the center point
      const scaleRatio = newScale / scale;
      const newX = centerX - (centerX - position.x) * scaleRatio;
      const newY = centerY - (centerY - position.y) * scaleRatio;
      
      // Apply directly to DOM for better performance
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      applyBackgroundTransformRef.current(newX, newY, newScale);
      
      // Update state
      setScale(newScale);
      setPosition({ x: newX, y: newY });
    }
  }, [position, scale]);
  
  // Mouse down handler for drag start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only drag with left button
    
    // Completely ignore events on tabs and UI elements
    const target = e.target as HTMLElement;
    if (target.closest('[role="tab"]') || 
        target.closest('[role="tablist"]') || 
        target.closest('[role="menuitem"]') || 
        target.closest('[role="menu"]') || 
        target.closest('[role="dialog"]') || 
        target.closest('[role="listbox"]') || 
        target.closest('[role="option"]') || 
        target.closest('[role="combobox"]') || 
        target.closest('button') || 
        target.closest('input') ||
        target.closest('textarea')) {
      return;
    }
    
    // Allow dragging even when zoomed
    isDraggingRef.current = true;
    setIsDragging(true);
    setIsUserInteracting(true);
    startDragPositionRef.current = { x: e.clientX, y: e.clientY };
    
    // Don't prevent default - only stop propagation
    // e.stopPropagation(); // Removed to allow dropdowns to close when clicking the canvas
  };
  
  // Mouse move handler for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    
    const dx = e.clientX - startDragPositionRef.current.x;
    const dy = e.clientY - startDragPositionRef.current.y;
    startDragPositionRef.current = { x: e.clientX, y: e.clientY };
    
    const newPosition = {
      x: positionRef.current.x + dx,
      y: positionRef.current.y + dy,
    };
    positionRef.current = newPosition;
    
    const s = scaleRef.current;
    if (contentRef.current) {
      contentRef.current.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0) scale(${s})`;
    }
    applyBackgroundTransformRef.current(newPosition.x, newPosition.y, s);
    
    e.stopPropagation();
    scheduleViewportNotify();
  }, [scheduleViewportNotify]);
  
  const endMouseDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setPosition({ ...positionRef.current });
    setIsDragging(false);
    setAutoRecenterEnabled(false);
    setTimeout(() => setIsUserInteracting(false), 200);
    scheduleViewportNotify();
  }, [scheduleViewportNotify]);

  // Handle mouse up globally to prevent stuck drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        endMouseDrag();
      }
    };
    
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('click', handleGlobalMouseUp, { capture: true, once: true });
    }
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('click', handleGlobalMouseUp, { capture: true });
    };
  }, [isDragging, endMouseDrag]);

  // Mouse up handler for drag end
  const handleMouseUp = () => {
    endMouseDrag();
  };
  
  // Mouse leave handler
  const handleMouseLeave = () => {
    endMouseDrag();
  };
  
  // Ctrl+wheel zoom: non-passive listener on the canvas only (not document) so normal page scroll stays cheap on Safari.
  // DOM updates every event; React state is flushed at most once per frame.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    let wheelZoomRaf: number | null = null;

    const flushWheelZoom = () => {
      wheelZoomRaf = null;
      setIsUserInteracting(true);
      setAutoRecenterEnabled(false);
      setScale(scaleRef.current);
      setPosition({ ...positionRef.current });
      setIsZoomedIn(scaleRef.current > 0.9);
      const info: ZoomableViewportInfo = {
        scale: scaleRef.current,
        position: { ...positionRef.current },
        canvasWidth: canvasRef.current?.getBoundingClientRect().width ?? 0,
        canvasHeight: canvasRef.current?.getBoundingClientRect().height ?? 0,
      };
      viewportStoreRef.current?.set(info);
      onViewportTransformChangeRef.current?.(info);
    };

    const wheelHandler = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="tab"]') || target.closest('[role="tablist"]')) {
        return;
      }

      if (!e.ctrlKey) return;

      e.preventDefault();
      e.stopPropagation();

      const prevScale = scaleRef.current;
      const position = positionRef.current;
      const newScale = Math.max(prevScale + (e.deltaY < 0 ? 0.1 : -0.1), 0.3);

      if (!canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      const scaleRatio = prevScale > 0 ? newScale / prevScale : 1;
      const newX = centerX - (centerX - position.x) * scaleRatio;
      const newY = centerY - (centerY - position.y) * scaleRatio;

      scaleRef.current = newScale;
      positionRef.current = { x: newX, y: newY };

      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      applyBackgroundTransformRef.current(newX, newY, newScale);

      if (wheelZoomRaf == null) {
        wheelZoomRaf = requestAnimationFrame(flushWheelZoom);
      }
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheelHandler);
      if (wheelZoomRaf != null) cancelAnimationFrame(wheelZoomRaf);
    };
  }, []);

  // Dot pattern: painted directly on the canvas-sized container via background-repeat.
  // Pan is applied as background-position and zoom as background-size, so the grid is
  // infinite within the canvas regardless of pan distance or zoom level. Using a
  // transformed giant tile (old approach) left bare bands on deep pans / zoom-outs
  // because the tile edges eventually entered the viewport.
  const currentColor = isDarkMode ? dotColorDark : dotColorLight;
  const dotSizeNum = parseFloat(dotSize) || 24;
  const dotRadiusNum = parseFloat(dotRadius) || 1;
  // `closest-side` makes the gradient extent = half the tile side; stop in % so the dot
  // radius scales proportionally with backgroundSize (consistent look at any zoom).
  const dotStopPct = Math.min(50, Math.max(0, (dotRadiusNum / (dotSizeNum / 2)) * 100));
  const dotBackgroundImage = `radial-gradient(circle closest-side, ${currentColor} ${dotStopPct}%, transparent ${dotStopPct}%)`;

  /** Mirror the content transform onto the dot pattern by updating bgSize + bgPosition. */
  const applyBackgroundTransformRef = useRef<(x: number, y: number, s: number) => void>(() => {});
  applyBackgroundTransformRef.current = (x: number, y: number, s: number) => {
    const el = backgroundRef.current;
    if (!el) return;
    const size = dotSizeNum * s;
    el.style.backgroundSize = `${size}px ${size}px`;
    el.style.backgroundPosition = `${x}px ${y}px`;
  };

  // Update cursor when drag state changes
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.cursor = isDragging ? "grabbing" : "grab";
    }
  }, [isDragging]);

  // Handle touch start for pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Skip for UI elements
    const target = e.target as HTMLElement;
    if (target.closest('[role="tab"]') || 
        target.closest('[role="tablist"]') || 
        target.closest('[role="menuitem"]') || 
        target.closest('[role="menu"]') || 
        target.closest('[role="dialog"]') || 
        target.closest('[role="listbox"]') || 
        target.closest('[role="option"]') || 
        target.closest('[role="combobox"]') || 
        target.closest('button') || 
        target.closest('input') ||
        target.closest('textarea')) {
      return;
    }
    
    if (e.touches.length === 2) {
      singleFingerPanRef.current = false;
      isDraggingRef.current = false;
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      setTouchStartDistance(distance);
      setTouchStartScale(scaleRef.current);
      setIsUserInteracting(true);
    } else if (e.touches.length === 1) {
      singleFingerPanRef.current = true;
      isDraggingRef.current = true;
      setIsDragging(true);
      setIsUserInteracting(true);
      startDragPositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);
  
  // Handle touch move for pinch-to-zoom and panning
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Skip for UI elements 
    const target = e.target as HTMLElement;
    if (target.closest('[role="tab"]') || 
        target.closest('[role="tablist"]') || 
        target.closest('[role="menuitem"]') || 
        target.closest('[role="menu"]') || 
        target.closest('[role="dialog"]') || 
        target.closest('[role="listbox"]') || 
        target.closest('[role="option"]') || 
        target.closest('[role="combobox"]') || 
        target.closest('button') || 
        target.closest('input') ||
        target.closest('textarea')) {
      return;
    }
    
    // Simplified touch handler
    if (e.touches.length === 2 && touchStartDistance !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Skip small changes to reduce processing
      if (Math.abs(distance - touchStartDistance) < 5) {
        return;
      }
      
      const scaleFactor = distance / touchStartDistance;
      const newScale = Math.max(Math.min(touchStartScale * scaleFactor, 2), 0.3);
      
      // Apply direct transform for better performance
      if (contentRef.current) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const canvasX = midX - rect.left;
          const canvasY = midY - rect.top;
          
          const scaleRatio = newScale / scaleRef.current;
          const newX = canvasX - (canvasX - positionRef.current.x) * scaleRatio;
          const newY = canvasY - (canvasY - positionRef.current.y) * scaleRatio;
          
          contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
          applyBackgroundTransformRef.current(newX, newY, newScale);
          
          setScale(newScale);
          setPosition({ x: newX, y: newY });
          scaleRef.current = newScale;
          positionRef.current = { x: newX, y: newY };
          scheduleViewportNotify();
        }
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && singleFingerPanRef.current) {
      const dx = e.touches[0].clientX - startDragPositionRef.current.x;
      const dy = e.touches[0].clientY - startDragPositionRef.current.y;
      startDragPositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      
      if (contentRef.current) {
        const newX = positionRef.current.x + dx;
        const newY = positionRef.current.y + dy;
        positionRef.current = { x: newX, y: newY };
        const s = scaleRef.current;
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${s})`;
        applyBackgroundTransformRef.current(newX, newY, s);
        scheduleViewportNotify();
      }
    }
  }, [touchStartDistance, touchStartScale, scheduleViewportNotify]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setTouchStartDistance(null);
    if (singleFingerPanRef.current) {
      setPosition({ ...positionRef.current });
      singleFingerPanRef.current = false;
    }
    isDraggingRef.current = false;
    setIsDragging(false);
    setAutoRecenterEnabled(false);
    
    setTimeout(() => {
      setIsUserInteracting(false);
    }, 200);
    scheduleViewportNotify();
  }, [scheduleViewportNotify]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts: +/- zoom, 1 fit, Shift+L sort layout. Skip when typing.
  const onSortRef = useRef(onSort);
  onSortRef.current = onSort;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      // Don't interfere with browser zoom (Cmd/Ctrl +/-) or existing system shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "1" && !e.shiftKey) {
        e.preventDefault();
        resetView();
      } else if (e.shiftKey && (e.key === "L" || e.key === "l")) {
        if (onSortRef.current) {
          e.preventDefault();
          onSortRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetView]);

  return (
    <div 
      ref={wrapperRef}
      className={`${className} relative w-full`}
      style={{ 
        height: height,
        minHeight: minHeight,
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        margin: "0 auto",
        width: "100%",
        backgroundColor: "transparent",
        padding: "0", 
        position: "relative",
      }}
    >
      <div
        ref={canvasRef}
        className="w-full h-full min-h-0"
        style={{ 
          position: "relative",
          overflow: "hidden",
          paddingRight: "20px",
          touchAction: "none",
          isolation: "isolate",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Dot pattern background: fills the canvas; pan/zoom via bg-position + bg-size
            so the pattern is effectively infinite (no bare edges on deep pans / zoom-out). */}
        <div
          ref={backgroundRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            backgroundImage: dotBackgroundImage,
            backgroundSize: `${dotSizeNum * scale}px ${dotSizeNum * scale}px`,
            backgroundPosition: `${position.x}px ${position.y}px`,
            backgroundRepeat: 'repeat',
            backgroundColor: 'transparent',
            transition: 'opacity 0.2s ease-in',
            opacity: isInitialized ? 1 : 0,
          }}
        />
        
        {/* Screen-space layer below the content (e.g. canvas-drawn edges). */}
        {screenSpaceBehind && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            {screenSpaceBehind}
          </div>
        )}

        {/* Content with transformation */}
        <div 
          ref={contentRef}
          style={{ 
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: '0 0',
            transition: 'opacity 0.2s ease-in',
            opacity: isInitialized ? 1 : 0,
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'inline-block',
            width: 'auto',
            minWidth: 'max-content',
            height: 'auto',
            zIndex: 2,
            overflow: "visible",
            paddingRight: "20px",
            // NOTE: deliberately NO `will-change: transform` here. The content
            // wrapper spans the full graph bounding box (which can be very
            // large); promoting it to its own GPU layer forced Safari to
            // rasterize a huge texture that often did not fit in VRAM and
            // fell back to software compositing, making pan *slower*.
          }}
        >
          {children}
        </div>

        {/* Screen-space layer above the content (e.g. hit-testing / hover overlays).
            The wrapper itself is transparent to pointer events; children opt in via their own styles. */}
        {screenSpaceFront && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            {screenSpaceFront}
          </div>
        )}
      </div>

      {/* Zoom control panel with fixed position */}
      <TooltipProvider delayDuration={200}>
        <div
          className="fixed bottom-8 flex items-center gap-1.5 bg-background/95 backdrop-blur-sm p-1.5 rounded-lg shadow-md border dark:border-white/5 border-black/5 z-50"
          style={{
            left: `${isLayoutCollapsed ? 92 : 268}px`,
            transition: 'left 0.2s ease-out' // Smooth transition when position changes
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                className="h-8 w-8"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="flex items-center gap-2">
                Zoom in
                <kbd className={tooltipKbdClass}>+</kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                className="h-8 w-8"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="flex items-center gap-2">
                Zoom out
                <kbd className={tooltipKbdClass}>−</kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetView}
                className="h-8 w-8"
                aria-label="Fit to screen"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="flex items-center gap-2">
                Fit to screen
                <kbd className={tooltipKbdClass}>1</kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          {onSort && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSort}
                  className="h-8 w-8"
                  aria-label="Sort layout"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="flex items-center gap-1.5">
                  Sort layout
                  <span className="inline-flex items-center gap-1">
                    <kbd className={tooltipKbdClass}>⇧</kbd>
                    <kbd className={tooltipKbdClass}>L</kbd>
                  </span>
                </span>
              </TooltipContent>
            </Tooltip>
          )}

          {extraControls && (
            <div className="ml-1 pl-1.5 border-l border-border flex items-center">
              {extraControls}
            </div>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}