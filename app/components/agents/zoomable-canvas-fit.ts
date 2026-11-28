import { useEffect, useRef, useCallback } from "react"
import type { CanvasState } from "./zoomable-canvas-state"
import type { ZoomableCanvasProps } from "./zoomable-canvas-types"
import debounce from "lodash/debounce"
export function useCanvasFit(s: CanvasState, {measureAsViewportFill, graphBounds, initialOffsetY = 0, children, recenterDependency, fitOnChildrenChange, viewportStore}: ZoomableCanvasProps, sidebarWidth: number) {
const { setIsZoomedIn, canvasRef, contentRef, contentDimensions, setContentDimensions, isInitialized, setIsInitialized, isUserInteracting, setIsUserInteracting, autoRecenterEnabled, setAutoRecenterEnabled, prevRecenterDepRef, prevLayoutCollapsedRef, scheduleViewportNotify, commitTransform } = s;
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
    
    // Use graphBounds if provided (avoids DOM reads and 0x0 errors on absolute trees)
    let contentSize = contentDimensions;
    if (graphBoundsRef.current && graphBoundsRef.current.width > 0 && graphBoundsRef.current.height > 0) {
      contentSize = graphBoundsRef.current;
    } else if (contentSize.width === 0 || contentSize.height === 0) {
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
    const contentHeight = contentSize.height * newScale;
    
    const canvasCenter = availableWidth / 2;
    const canvasCenterY = availableHeight / 2;
    
    const rawOffsetX = 'offsetX' in contentSize ? contentSize.offsetX : undefined;
    const rawOffsetY = 'offsetY' in contentSize ? contentSize.offsetY : undefined;
    const offsetX = typeof rawOffsetX === 'number' ? rawOffsetX * newScale : 0;
    const offsetY = typeof rawOffsetY === 'number' ? rawOffsetY * newScale : 0;
    
    const finalX = canvasCenter - (contentWidth / 2) - offsetX;
    const finalY = canvasCenterY - (contentHeight / 2) + initialOffsetY - offsetY;
    
    return { scale: newScale, x: finalX, y: finalY };
  }, [contentDimensions, measureContent, initialOffsetY]);

  const applyContainTransform = useCallback(async () => {
    const { scale, x, y } = await calculateContainTransform();
    commitTransform(x, y, scale);
    setIsZoomedIn(false);
  }, [calculateContainTransform, commitTransform]);
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
    
    const sidebarWidthChanged = prevLayoutCollapsedRef.current !== sidebarWidth;
    prevLayoutCollapsedRef.current = sidebarWidth;
    
    if (sidebarWidthChanged && isInitialized && !isUserInteracting && autoRecenterEnabled) {
      timer = setTimeout(() => {
        void applyContainTransform();
      }, 50);
    }
    
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, [isInitialized, sidebarWidth, applyContainTransform, isUserInteracting, autoRecenterEnabled]);

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
    
    const applyTransform = () => {
      calculateContainTransform().then(({ scale: newScale, x: newX, y: newY }) => {
        commitTransform(newX, newY, newScale);
        setIsZoomedIn(false);
      });
    };

    if (graphBoundsRef.current && graphBoundsRef.current.width > 0 && graphBoundsRef.current.height > 0) {
      applyTransform();
    } else {
      measureContent().then(applyTransform);
    }
  }, [measureContent, calculateContainTransform, commitTransform]);

  useEffect(() => viewportStore?.subscribeFocus?.(({ x, y, scale = 0.7 }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2 || ![x, y, scale].every(Number.isFinite) || scale <= 0) return;
    setAutoRecenterEnabled(false);
    setIsUserInteracting(false);
    commitTransform(rect.width / 2 - x * scale, rect.height / 2 - y * scale, scale);
    setIsZoomedIn(scale > 0.9);
  }), [viewportStore, commitTransform]);
return { resetView };
}
