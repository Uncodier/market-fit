import { useEffect, useRef, useCallback } from "react"
import type { CanvasState } from "./zoomable-canvas-state"
import type { ZoomableCanvasProps } from "./zoomable-canvas-types"
export function useCanvasBackground(s: CanvasState, {dotColorDark = "rgba(255, 255, 255, 0.07)", dotColorLight = "rgba(0, 0, 0, 0.07)", dotSize = "24px", dotRadius = "1px"}: ZoomableCanvasProps, isDarkMode: boolean) {
const { positionRef, scaleRef, applyBackgroundTransformRef } = s;
  // Dot pattern: painted on a dedicated canvas via createPattern to avoid CSS radial-gradient 
  // re-rasterization per frame in Safari.
  const currentColor = isDarkMode ? dotColorDark : dotColorLight;
  const dotSizeNum = parseFloat(dotSize) || 24;
  const dotRadiusNum = parseFloat(dotRadius) || 1;
  
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const dotPatternCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgDrawRafRef = useRef<number | null>(null);

  const drawBg = useCallback((x: number, y: number, s: number) => {
    if (!bgCanvasRef.current) return;
    const canvas = bgCanvasRef.current;
    
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    
    // Use DPR 1 for background to save fill-rate, dots are very subtle
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    const size = dotSizeNum * s;
    if (size < 2) return;
    
    // Quantize size to avoid recreating the pattern too often during smooth zoom
    const qSize = Math.max(2, Math.round(size * 2) / 2);
    
    if (!dotPatternCanvasRef.current || 
        dotPatternCanvasRef.current.width !== qSize || 
        dotPatternCanvasRef.current.dataset.color !== currentColor) {
      
      const patCanvas = document.createElement('canvas');
      patCanvas.width = qSize;
      patCanvas.height = qSize;
      patCanvas.dataset.color = currentColor;
      const pCtx = patCanvas.getContext('2d', { alpha: true });
      if (pCtx) {
        const cx = qSize / 2;
        const cy = qSize / 2;
        const r = (dotRadiusNum / dotSizeNum) * qSize;
        
        pCtx.fillStyle = currentColor;
        pCtx.beginPath();
        pCtx.arc(cx, cy, r, 0, Math.PI * 2);
        pCtx.fill();
      }
      dotPatternCanvasRef.current = patCanvas;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pattern = ctx.createPattern(dotPatternCanvasRef.current, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.save();
      const offsetX = x % qSize;
      const offsetY = y % qSize;
      ctx.translate(offsetX, offsetY);
      // Fill enough to cover the screen including the negative offset shift
      ctx.fillRect(-offsetX, -offsetY, canvas.width + qSize, canvas.height + qSize);
      ctx.restore();
    }
  }, [currentColor, dotSizeNum, dotRadiusNum]);

  /** Mirror the content transform onto the dot pattern by drawing on the background canvas. */
  applyBackgroundTransformRef.current = (x: number, y: number, s: number) => {
    if (bgDrawRafRef.current) cancelAnimationFrame(bgDrawRafRef.current);
    bgDrawRafRef.current = requestAnimationFrame(() => {
      bgDrawRafRef.current = null;
      drawBg(x, y, s);
    });
  };

  useEffect(() => {
    // Initial draw when dependencies change
    drawBg(positionRef.current.x, positionRef.current.y, scaleRef.current);
  }, [drawBg]);

  // Clean up
  useEffect(() => {
    return () => {
      if (bgDrawRafRef.current !== null) {
        cancelAnimationFrame(bgDrawRafRef.current);
      }
    };
  }, []);
return { bgCanvasRef };
}
