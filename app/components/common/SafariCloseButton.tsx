'use client';

import React, { useEffect, useRef } from 'react';
import { X } from '@/app/components/ui/icons';

interface SafariCloseButtonProps {
  onClick?: () => void;
  className?: string;
  iconSize?: number;
}

export function SafariCloseButton({
  onClick,
  className = '',
  iconSize = 16
}: SafariCloseButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    // Detectamos si estamos en Safari
    const isSafari = 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g);
    
    if (isSafari && buttonRef.current) {
      // Aplicamos estilos extremadamente agresivos para Safari
      const button = buttonRef.current;
      button.style.display = 'inline-flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.position = 'relative';
      button.style.lineHeight = '1';
      button.style.width = `${iconSize + 8}px`;
      button.style.height = `${iconSize + 8}px`;
      button.style.padding = '0';
      button.style.margin = '0';
      
      // Encontramos el SVG y le aplicamos estilos específicos
      const svgElement = button.querySelector('svg');
      if (svgElement) {
        svgElement.style.display = 'block';
        svgElement.style.visibility = 'visible';
        svgElement.style.width = `${iconSize}px`;
        svgElement.style.height = `${iconSize}px`;
        svgElement.style.minWidth = `${iconSize}px`;
        svgElement.style.minHeight = `${iconSize}px`;
        svgElement.style.margin = 'auto';
        svgElement.style.position = 'static';
      }
    }
  }, [iconSize]);
  
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`safari-close-button rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground ${className}`}
      aria-label="Close"
      type="button"
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
} 