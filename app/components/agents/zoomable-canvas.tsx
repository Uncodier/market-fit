import React, { useEffect, useRef } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { Button } from "@/app/components/ui/button"
import { ZoomIn, ZoomOut, Maximize, LayoutGrid } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useTheme } from "@/app/context/ThemeContext"
import { useCanvasState } from "./zoomable-canvas-state"
import { useCanvasFit } from "./zoomable-canvas-fit"
import { useCanvasBackground } from "./zoomable-canvas-background"
import { useCanvasMouse } from "./zoomable-canvas-mouse"
import { useCanvasTouch } from "./zoomable-canvas-touch"
import type { ZoomableCanvasProps } from "./zoomable-canvas-types"
export type { ZoomableViewportInfo } from "./zoomable-canvas-types"
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
/** Square 1:1 keycap for shortcut hints inside tooltips. */
const tooltipKbdClass =
  "pointer-events-none inline-flex h-4 w-4 items-center justify-center rounded border bg-muted font-mono text-[10px] font-medium leading-none text-muted-foreground"

export function ZoomableCanvas(props: ZoomableCanvasProps) {
 const {children, className, height = "calc(100vh - 135px)", minHeight = "600px", screenSpaceBehind, screenSpaceFront, onSort, extraControls} = props;
 const { isLayoutCollapsed } = useLayout();
 const { isDarkMode } = useTheme();
 const state = useCanvasState(props, isLayoutCollapsed);
 const { scale, position, isDragging, isInitialized, wrapperRef, canvasRef, contentRef } = state;
 const { bgCanvasRef } = useCanvasBackground(state, props, isDarkMode);
 const { resetView } = useCanvasFit(state, {...props, fitOnChildrenChange: props.fitOnChildrenChange ?? true}, isLayoutCollapsed);
 const { zoomIn, zoomOut, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } = useCanvasMouse(state);
 const { handleTouchStart, handleTouchMove, handleTouchEnd } = useCanvasTouch(state);
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
          userSelect: isDragging ? "none" : undefined,
          WebkitUserSelect: isDragging ? "none" : undefined,
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
        {/* Dot pattern background: fills the canvas; pan/zoom via canvas createPattern 
            so the pattern is effectively infinite and cheap to render. */}
        <canvas
          ref={bgCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
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
