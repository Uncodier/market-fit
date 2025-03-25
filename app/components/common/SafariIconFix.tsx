'use client';

import React, { useEffect, useRef } from 'react';

interface SafariIconFixProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
  className?: string;
}

export function SafariIconFix({ children, width = 16, height = 16, className = '' }: SafariIconFixProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Solo aplicamos los ajustes si estamos en Safari
    const isSafari = 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g);
      
    if (isSafari && containerRef.current) {
      const svgElements = containerRef.current.querySelectorAll('svg');
      
      svgElements.forEach(svg => {
        svg.style.display = 'block';
        svg.style.width = `${width}px`;
        svg.style.height = `${height}px`;
        svg.style.minWidth = `${width}px`;
        svg.style.minHeight = `${height}px`;
        svg.style.position = 'static';
      });
      
      // Ajustamos también el contenedor
      if (containerRef.current) {
        containerRef.current.style.display = 'inline-flex';
        containerRef.current.style.alignItems = 'center';
        containerRef.current.style.justifyContent = 'center';
      }
    }
  }, [width, height]);
  
  return (
    <div ref={containerRef} className={`safari-icon-wrapper ${className}`}>
      {children}
    </div>
  );
} 