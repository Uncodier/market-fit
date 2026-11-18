import React, { useEffect, useRef, useCallback } from "react"
import type { CanvasState } from "./zoomable-canvas-state"
export function useCanvasTouch(s: CanvasState) {
const { setScale, setPosition, setIsDragging, isDraggingRef, positionRef, scaleRef, startDragPositionRef, setIsZoomedIn, canvasRef, contentRef, setIsUserInteracting, setAutoRecenterEnabled, touchStartDistance, setTouchStartDistance, touchStartScale, setTouchStartScale, singleFingerPanRef, scheduleViewportNotify, applyBackgroundTransformRef } = s;
  const touchRafRef = useRef<number | null>(null);

  const flushTouch = useCallback(() => {
    touchRafRef.current = null;
    setScale(scaleRef.current);
    setPosition({ ...positionRef.current });
    setIsZoomedIn(scaleRef.current > 0.9);
  }, []);

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
        target.closest('textarea') ||
        target.closest('select')) {
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
        target.closest('textarea') ||
        target.closest('select')) {
      return;
    }
    
    // Simplified touch handler
    if (e.touches.length === 2 && touchStartDistance !== null) {
      // Prevent browser zoom/scroll.
      if (e.cancelable) e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Skip small changes to reduce processing
      if (Math.abs(distance - touchStartDistance) < 5) {
        return;
      }
      
      const rawScaleFactor = distance / touchStartDistance;
      // Dampen pinch sensitivity.
      const PINCH_SENSITIVITY = 0.6;
      const scaleFactor = 1 + (rawScaleFactor - 1) * PINCH_SENSITIVITY;
      const newScale = Math.max(Math.min(touchStartScale * scaleFactor, 2), 0.01);
      
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
          
          scaleRef.current = newScale;
          positionRef.current = { x: newX, y: newY };
          scheduleViewportNotify();
          
          if (touchRafRef.current === null) {
            touchRafRef.current = requestAnimationFrame(flushTouch);
          }
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
  
  useEffect(() => {
    return () => {
      if (touchRafRef.current !== null) {
        cancelAnimationFrame(touchRafRef.current);
      }
    };
  }, []);

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
return { handleTouchStart, handleTouchMove, handleTouchEnd };
}
