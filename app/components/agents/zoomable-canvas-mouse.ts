import React, { useEffect, useRef, useCallback } from "react"
import type { CanvasState } from "./zoomable-canvas-state"
import type { ZoomableViewportInfo } from "./zoomable-canvas-types"
export function useCanvasMouse(s: CanvasState) {
const { scale, setScale, position, setPosition, isDragging, setIsDragging, isDraggingRef, positionRef, scaleRef, startDragPositionRef, setIsZoomedIn, canvasRef, wrapperRef, contentRef, lastMousePosRef, setIsUserInteracting, setAutoRecenterEnabled, onViewportTransformChangeRef, viewportStoreRef, scheduleViewportNotify, enableWheelPanRef, applyBackgroundTransformRef } = s;
  // Zoom in function
  const zoomIn = useCallback(() => {
    bumpInteractionSettleRef.current();
    setAutoRecenterEnabled(false);
    
    const newScale = Math.min(scale * 1.1, 2);
    
    // Activate zoom state when above threshold
    if (newScale > 0.9) {
      setIsZoomedIn(true);
    }
    
    // Adjust position to maintain focal point
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // Calculate target point: mouse pos if available, otherwise center
      const targetX = lastMousePosRef.current ? lastMousePosRef.current.x : canvasRect.width / 2;
      const targetY = lastMousePosRef.current ? lastMousePosRef.current.y : canvasRect.height / 2;
      
      // Calculate new position maintaining the target point
      const scaleRatio = newScale / scale;
      const newX = targetX - (targetX - position.x) * scaleRatio;
      const newY = targetY - (targetY - position.y) * scaleRatio;
      
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
    bumpInteractionSettleRef.current();
    setAutoRecenterEnabled(false);
    
    const newScale = Math.max(scale * 0.9, 0.01);
    
    // Deactivate zoom state when below threshold
    if (newScale <= 0.9) {
      setIsZoomedIn(false);
    }
    
    // Adjust position to maintain focal point
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // Calculate target point: mouse pos if available, otherwise center
      const targetX = lastMousePosRef.current ? lastMousePosRef.current.x : canvasRect.width / 2;
      const targetY = lastMousePosRef.current ? lastMousePosRef.current.y : canvasRect.height / 2;
      
      // Calculate new position maintaining the target point
      const scaleRatio = newScale / scale;
      const newX = targetX - (targetX - position.x) * scaleRatio;
      const newY = targetY - (targetY - position.y) * scaleRatio;
      
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
        target.closest('textarea') ||
        target.closest('select')) {
      return;
    }
    
    // Allow dragging even when zoomed
    isDraggingRef.current = true;
    setIsDragging(true);
    setIsUserInteracting(true);
    startDragPositionRef.current = { x: e.clientX, y: e.clientY };
    
    // Clear any selection to ensure clean drag start
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
    
    // Don't prevent default - only stop propagation
    // e.stopPropagation(); // Removed to allow dropdowns to close when clicking the canvas
  };
  
  // Mouse move handler for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    
    e.preventDefault(); // Prevent text selection while dragging
    
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

  /**
   * Wheel / zoom-button interactions have no natural "end" event (unlike drag).
   * Without this settle timer `isUserInteracting` stayed true forever after the
   * first trackpad scroll, which froze viewport commits (turbo mode) and kept
   * canvases at interaction DPR — the canvas looked stuck, especially on Safari
   * where trackpad wheel is the primary navigation.
   */
  const interactionSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpInteractionSettleRef = useRef<() => void>(() => {});
  bumpInteractionSettleRef.current = () => {
    setIsUserInteracting(true);
    if (interactionSettleTimerRef.current) clearTimeout(interactionSettleTimerRef.current);
    interactionSettleTimerRef.current = setTimeout(() => {
      interactionSettleTimerRef.current = null;
      // Don't end the interaction if a drag is still in progress (drag has its own end).
      if (isDraggingRef.current) return;
      setIsUserInteracting(false);
      scheduleViewportNotify();
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (interactionSettleTimerRef.current) {
        clearTimeout(interactionSettleTimerRef.current);
      }
    };
  }, []);

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
  
  // Ctrl+wheel zoom (and optional plain-wheel pan): non-passive listener on the canvas only
  // (not document) so normal page scroll stays cheap on Safari. DOM updates every event;
  // React state is flushed at most once per frame.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    let wheelRaf: number | null = null;

    const flushWheel = () => {
      wheelRaf = null;
      bumpInteractionSettleRef.current();
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

      // Ctrl/Cmd+wheel zooms toward the canvas centre.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const prevScale = scaleRef.current;
        const position = positionRef.current;
        
        // Smooth proportional zoom for trackpads.
        // Clamp mouse-wheel deltas to logical zoom steps (~10%).
        const delta = Math.max(-20, Math.min(20, e.deltaY));
        const ZOOM_SENSITIVITY = 0.005;
        const zoomFactor = Math.exp(-delta * ZOOM_SENSITIVITY);
        const newScale = Math.max(prevScale * zoomFactor, 0.01);

        if (!canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        const scaleRatio = prevScale > 0 ? newScale / prevScale : 1;
        const newX = mouseX - (mouseX - position.x) * scaleRatio;
        const newY = mouseY - (mouseY - position.y) * scaleRatio;

        scaleRef.current = newScale;
        positionRef.current = { x: newX, y: newY };

        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
        }
        applyBackgroundTransformRef.current(newX, newY, newScale);

        if (wheelRaf == null) {
          wheelRaf = requestAnimationFrame(flushWheel);
        }
        return;
      }

      // Plain wheel / trackpad scroll pans the canvas (opt-in).
      if (!enableWheelPanRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      let dx = -e.deltaX;
      let dy = -e.deltaY;
      // Mice without a horizontal wheel: Shift+wheel scrolls horizontally.
      if (e.shiftKey && e.deltaX === 0) {
        dx = -e.deltaY;
        dy = 0;
      }

      const newX = positionRef.current.x + dx;
      const newY = positionRef.current.y + dy;
      positionRef.current = { x: newX, y: newY };

      const s = scaleRef.current;
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${s})`;
      }
      applyBackgroundTransformRef.current(newX, newY, s);

      if (wheelRaf == null) {
        wheelRaf = requestAnimationFrame(flushWheel);
      }
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheelHandler);
      if (wheelRaf != null) cancelAnimationFrame(wheelRaf);
    };
  }, []);
  // Update cursor when drag state changes
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.cursor = isDragging ? "grabbing" : "grab";
    }
  }, [isDragging]);
  // Track mouse position for zoom focal point
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      lastMousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    
    const handleLeave = () => {
      lastMousePosRef.current = null;
    };
    
    el.addEventListener('mousemove', handleMove, { passive: true });
    el.addEventListener('mouseleave', handleLeave, { passive: true });
    
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);
return { zoomIn, zoomOut, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave };
}
