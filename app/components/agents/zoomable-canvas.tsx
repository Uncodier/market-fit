import React, { useState, useEffect, useRef, useCallback } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { Button } from "@/app/components/ui/button"
import { ZoomIn, ZoomOut, Maximize } from "@/app/components/ui/icons"
import { debounce, throttle } from "lodash"

interface ZoomableCanvasProps {
  children: React.ReactNode
  className?: string
}

export function ZoomableCanvas({ 
  children, 
  className
}: ZoomableCanvasProps) {
  // Use the layout context to get the current state
  const { isLayoutCollapsed } = useLayout();
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [maxZoom, setMaxZoom] = useState(1);
  const [childrenKey, setChildrenKey] = useState(0); // Add a key to track children changes
  const [isUserInteracting, setIsUserInteracting] = useState(false); // Track user interaction
  const [autoRecenterEnabled, setAutoRecenterEnabled] = useState(true); // Control if auto-recenter is enabled
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartScale, setTouchStartScale] = useState<number>(1);

  // Variables for animation
  const animationRef = useRef<number | null>(null);
  const targetPositionRef = useRef({ x: 0, y: 0, scale: 1 });
  const currentPositionRef = useRef({ x: 0, y: 0, scale: 1 });
  const isAnimatingRef = useRef(false);

  // Define CSS variables for the dot pattern
  useEffect(() => {
    // Add CSS variables for the dots pattern
    document.documentElement.style.setProperty('--dots-color-light', 'rgba(0, 0, 0, 0.07)');
    document.documentElement.style.setProperty('--dots-color-dark', 'rgba(255, 255, 255, 0.07)');
    document.documentElement.style.setProperty('--dots-size', '24px');
    document.documentElement.style.setProperty('--dots-radius', '1px');
    
    return () => {
      // Clean up when component unmounts
      document.documentElement.style.removeProperty('--dots-color-light');
      document.documentElement.style.removeProperty('--dots-color-dark');
      document.documentElement.style.removeProperty('--dots-size');
      document.documentElement.style.removeProperty('--dots-radius');
    };
  }, []);

  // Detect theme to use the correct dot color
  useEffect(() => {
    const updateDotColor = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      document.documentElement.style.setProperty(
        '--theme-dots-color', 
        isDarkMode ? 'var(--dots-color-dark)' : 'var(--dots-color-light)'
      );
    };

    // Setup initially
    updateDotColor();

    // Observe theme changes
    const observer = new MutationObserver(updateDotColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

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
        minWidth: contentRef.current.style.minWidth,
        position: contentRef.current.style.position,
        display: contentRef.current.style.display,
        overflow: contentRef.current.style.overflow,
        paddingRight: contentRef.current.style.paddingRight
      };
      
      // Temporarily remove transformations and apply measurement styles
      contentRef.current.style.transform = 'none';
      contentRef.current.style.width = 'auto';
      contentRef.current.style.minWidth = 'none';
      contentRef.current.style.position = 'static';
      contentRef.current.style.display = 'block';
      contentRef.current.style.overflow = 'visible';
      contentRef.current.style.paddingRight = '0';
      
      // Force browser to apply style changes
      void contentRef.current.offsetWidth;
      
      // Clone the node to measure it without affecting the original
      // This helps prevent layout thrashing and style conflicts
      const clone = contentRef.current.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.left = '0';
      clone.style.top = '0';
      document.body.appendChild(clone);
      
      // Measure the cloned content
      const rect = clone.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      // Remove the clone
      document.body.removeChild(clone);
      
      // Add buffer to ensure all content is visible
      const dimensions = {
        width: width + 100, // Add 100px buffer
        height: height + 20
      };
      
      // Restore all original styles in correct order
      Object.entries(originalStyles).forEach(([prop, value]) => {
        // @ts-ignore - dynamic property assignment
        contentRef.current!.style[prop] = value;
      });
      
      // Save dimensions for future calculations
      setContentDimensions(dimensions);
      
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
    
    // Command panel width is fixed at 300px
    const commandPanelWidth = 300;
    
    // We need to calculate the effective available width
    // Start with the window width and subtract the command panel
    const windowWidth = window.innerWidth;
    const sidebarWidth = isLayoutCollapsed ? 72 : 240;
    
    // The effective available width is the window width minus sidebar and command panel
    const availableWidth = windowWidth - sidebarWidth - commandPanelWidth;
    
    // Use a small margin to avoid content touching edges
    const margin = 0.02; // 2% margin
    
    // Calculate scale to fit content within available area
    const scaleX = (availableWidth * (1 - margin)) / contentSize.width;
    const scaleY = (canvasRect.height * (1 - margin)) / contentSize.height;
    
    // Use the smaller scale to ensure content fits in both dimensions
    // but limit to reasonable range
    const newScale = Math.min(Math.min(scaleX, scaleY), 0.95);
    
    // Get the scaled content dimensions
    const contentWidth = contentSize.width * newScale;
    
    // Calculate position to center content in the canvas
    // The goal is to center the content visually in the available space
    
    // First calculate the center point in the canvas
    const canvasCenter = canvasRect.width / 2;
    
    // Then calculate what would be a centered position
    const normalCenteredX = canvasCenter - (contentWidth / 2);
    
    // Apply a positive offset to move the diagram to the right
    // Instead of a negative offset that moves it left, use a positive one
    const rightOffset = 20; // Fixed pixel value to move right
    
    // Combine the centered position with the right offset
    const finalX = normalCenteredX + rightOffset;
    
    // Calculate vertical position with slight top offset for aesthetics
    const newY = (canvasRect.height * 0.05);
    
    return { scale: newScale, x: finalX, y: newY };
  }, [contentDimensions, measureContent, isLayoutCollapsed]);

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
      
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(${targetScale})`;
      }
      
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
      
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      
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
          contentRef.current.style.transition = 'none';
          contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${newScale})`;
        }
        
        if (backgroundRef.current) {
          backgroundRef.current.style.transition = 'none';
          backgroundRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${newScale})`;
        }
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
    
    if (backgroundRef.current) {
      backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
    }
    
    // Update state
    setScale(newScale);
    setPosition({ x: newX, y: newY });
    setIsZoomedIn(false);
  }, [calculateContainTransform]);

  // Measure content on mount and when it changes
  useEffect(() => {
    if (!isInitialized) {
      // Allow time for DOM to fully render
      const timer = setTimeout(async () => {
        await measureContent();
        await applyContainTransform();
        setIsInitialized(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialized, measureContent, applyContainTransform]);

  // Readjust when window size or menu state changes - debounced to prevent excessive calculations
  const debouncedResize = useCallback(debounce(async () => {
    if (isInitialized && !isUserInteracting && autoRecenterEnabled) {
      await measureContent(); // Recalculate maxZoom when size changes
      await applyContainTransform();
    }
  }, 100), [isInitialized, isUserInteracting, autoRecenterEnabled, measureContent, applyContainTransform]);

  // Readjust when window size or menu state changes
  useEffect(() => {
    window.addEventListener('resize', debouncedResize);
    
    // Readjust when menu state changes
    if (isInitialized && !isUserInteracting && autoRecenterEnabled) {
      // Avoid calling measureContent here to prevent infinite loops
      applyContainTransform();
    }
    
    return () => window.removeEventListener('resize', debouncedResize);
  }, [isInitialized, isLayoutCollapsed, applyContainTransform, debouncedResize, isUserInteracting, autoRecenterEnabled]);

  // New effect to detect changes in children (like expanded cards)
  useEffect(() => {
    if (isInitialized && !isUserInteracting && autoRecenterEnabled) {
      // Use a small delay to allow DOM to update after children change
      const timer = setTimeout(async () => {
        await measureContent();
        await applyContainTransform();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [children, isInitialized, measureContent, applyContainTransform, isUserInteracting, autoRecenterEnabled]);

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
        
        if (backgroundRef.current) {
          backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
        }
        
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
      
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      
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
      
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
      }
      
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
        target.closest('button') || 
        target.closest('input') ||
        !contentRef.current?.contains(target)) {
      return;
    }
    
    // Allow dragging even when zoomed
    setIsDragging(true);
    setIsUserInteracting(true);
    setStartDragPosition({ x: e.clientX, y: e.clientY });
    
    // Don't prevent default - only stop propagation
    e.stopPropagation();
  };
  
  // Mouse move handler for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    // Performance optimization: use small movements threshold
    const dx = e.clientX - startDragPosition.x;
    const dy = e.clientY - startDragPosition.y;
    
    // Skip tiny movements to reduce processing
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    
    // Allow movement in any mode
    setPosition(prev => {
      const newPosition = { x: prev.x + dx, y: prev.y + dy };
      
      // Apply transform directly for immediate feedback
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0) scale(${scale})`;
      }
      
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0) scale(${scale})`;
      }
      
      return newPosition;
    });
    
    setStartDragPosition({ x: e.clientX, y: e.clientY });
    
    // Only stop propagation, don't prevent default
    e.stopPropagation();
  }, [isDragging, startDragPosition, scale]);
  
  // Mouse up handler for drag end
  const handleMouseUp = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setAutoRecenterEnabled(false);
    
    // Use shorter timeout
    setTimeout(() => {
      setIsUserInteracting(false);
    }, 200);
  };
  
  // Mouse leave handler
  const handleMouseLeave = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setAutoRecenterEnabled(false);
    
    // Use shorter timeout
    setTimeout(() => {
      setIsUserInteracting(false);
    }, 200);
  };
  
  // Handle wheel for zoom and pan
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Skip handling if on UI elements
    const target = e.target as HTMLElement;
    if (target.closest('[role="tab"]') || 
        target.closest('[role="tablist"]') || 
        !contentRef.current?.contains(target)) {
      return;
    }
      
    // Only handle ctrl+wheel for zooming
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      
      setIsUserInteracting(true);
      setAutoRecenterEnabled(false);
      
      // Simplify zoom calculation
      const newScale = Math.max(scale + (e.deltaY < 0 ? 0.1 : -0.1), 0.3);
      
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        const scaleRatio = newScale / scale;
        const newX = centerX - (centerX - position.x) * scaleRatio;
        const newY = centerY - (centerY - position.y) * scaleRatio;
        
        // Apply transform directly
        setScale(newScale);
        setPosition({ x: newX, y: newY });
        
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
        }
        
        if (backgroundRef.current) {
          backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
        }
        
        setIsZoomedIn(newScale > 0.9);
      }
    }
  }, [scale, position]);
  
  // Prevent scroll but keep overflow visible - simplified
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Simplified wheel handler - only prevent default for ctrl+wheel in content
    const wheelHandler = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      
      // Skip if not in canvas or is a UI element
      if (!canvasRef.current?.contains(target) || 
          target.closest('[role="tab"]') || 
          target.closest('[role="tablist"]')) {
        return;
      }
      
      // Only prevent for ctrl+wheel zoom
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', wheelHandler);
    };
  }, [canvasRef]);

  // CSS for dot pattern background (infinite grid)
  const dotPatternStyle = {
    backgroundSize: 'var(--dots-size) var(--dots-size)',
    backgroundImage: `
      radial-gradient(circle, var(--dot-color) var(--dots-radius), transparent var(--dots-radius))
    `,
    backgroundPosition: '0 0',
    backgroundColor: 'transparent',
    '--dot-color': 'var(--theme-dots-color)',
    position: 'absolute',
    top: '-200%',    // Center pattern and extend to cover more area
    left: '-200%',   // Center pattern and extend to cover more area
    width: '500%',   // Extend more for more dots
    height: '500%',  // Extend more for more dots
    transformOrigin: '0 0',
    pointerEvents: 'none'
  } as React.CSSProperties;

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
        target.closest('button') || 
        target.closest('input')) {
      return;
    }
    
    if (e.touches.length === 2) {
      // Simplify pinch logic
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      setTouchStartDistance(distance);
      setTouchStartScale(scale);
      setIsUserInteracting(true);
    } else if (e.touches.length === 1) {
      // Single touch panning
      setIsDragging(true);
      setIsUserInteracting(true);
      setStartDragPosition({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [scale]);
  
  // Handle touch move for pinch-to-zoom and panning
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Skip for UI elements 
    const target = e.target as HTMLElement;
    if (target.closest('[role="tab"]') || 
        target.closest('[role="tablist"]') || 
        target.closest('button') || 
        target.closest('input')) {
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
      if (contentRef.current && backgroundRef.current) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const canvasX = midX - rect.left;
          const canvasY = midY - rect.top;
          
          const scaleRatio = newScale / scale;
          const newX = canvasX - (canvasX - position.x) * scaleRatio;
          const newY = canvasY - (canvasY - position.y) * scaleRatio;
          
          contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
          backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
          
          // Only update state after transform applied
          setScale(newScale);
          setPosition({ x: newX, y: newY });
        }
      }
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - startDragPosition.x;
      const dy = e.touches[0].clientY - startDragPosition.y;
      
      // Skip small movements
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        return;
      }
      
      // Direct DOM manipulation for better performance
      if (contentRef.current && backgroundRef.current) {
        const newX = position.x + dx;
        const newY = position.y + dy;
        
        contentRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${scale})`;
        backgroundRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${scale})`;
        
        // Update state after transform
        setPosition({ x: newX, y: newY });
      }
      
      setStartDragPosition({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [touchStartDistance, touchStartScale, scale, position, isDragging, startDragPosition]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setTouchStartDistance(null);
    setIsDragging(false);
    setAutoRecenterEnabled(false);
    
    // Shorter timeout
    setTimeout(() => {
      setIsUserInteracting(false);
    }, 200);
  }, []);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={wrapperRef}
      className={`${className} relative w-full`}
      style={{ 
        height: "calc(100vh - 64px)",
        minHeight: "600px",
        overflow: "visible",
        cursor: isDragging ? "grabbing" : "grab",
        margin: "0 auto",
        width: "100%",
        backgroundColor: "transparent",
        padding: "0", 
        position: "relative",
        transition: "all 0.2s ease-out"
      }}
    >
      <div
        ref={canvasRef}
        className="w-full h-full"
        style={{ 
          overflow: "visible",
          paddingRight: "20px",
          touchAction: "none" // Prevent browser handling of touch gestures
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Dot pattern background layer that moves with content */}
        <div 
          ref={backgroundRef}
          style={{ 
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: '0 0',
            transition: 'none',
            position: 'absolute',
            display: 'inline-block',
            width: '100%',
            height: '100%',
            zIndex: 0,
            overflow: "visible",
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            perspective: 1000,
            WebkitBackfaceVisibility: 'hidden',
            WebkitPerspective: 1000,
            WebkitTransformStyle: 'preserve-3d'
          }}
        >
          <div style={dotPatternStyle}></div>
        </div>
        
        {/* Content with transformation */}
        <div 
          ref={contentRef}
          style={{ 
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: '0 0',
            transition: 'none',
            position: 'absolute',
            display: 'inline-block',
            width: 'auto',
            minWidth: 'max-content',
            height: 'auto',
            zIndex: 1,
            overflow: "visible",
            paddingRight: "20px",
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            perspective: 1000,
            WebkitBackfaceVisibility: 'hidden',
            WebkitPerspective: 1000,
            WebkitTransformStyle: 'preserve-3d'
          }}
        >
          {children}
        </div>
      </div>

      {/* Zoom control panel with fixed position */}
      <div 
        className="fixed bottom-8 flex items-center gap-1.5 bg-background/95 backdrop-blur-sm p-1.5 rounded-lg shadow-md border border-border z-50"
        style={{ 
          left: `${isLayoutCollapsed ? 92 : 268}px`, 
          transition: 'left 0.2s ease-out' // Smooth transition when position changes
        }}
      >
        <Button
          variant="ghost" 
          size="icon"
          onClick={zoomIn}
          className="h-8 w-8"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost" 
          size="icon"
          onClick={zoomOut}
          className="h-8 w-8"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost" 
          size="icon"
          onClick={resetView}
          className="h-8 w-8"
          aria-label="Reset view"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        
        <div className="ml-1 px-2 py-1 bg-accent/70 text-accent-foreground dark:bg-accent/50 text-[10px] rounded-sm font-medium border border-border">
          Drag to navigate
        </div>
      </div>
    </div>
  );
}