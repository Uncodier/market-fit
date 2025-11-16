'use client';

import React, { useEffect, useRef } from 'react';
import { X } from '@/app/components/ui/icons';

interface SafariCloseButtonAbsoluteProps {
  onClick?: () => void;
  className?: string;
  iconSize?: number;
  top?: string;
  right?: string;
}

export function SafariCloseButtonAbsolute({
  onClick,
  className = '',
  iconSize = 14.4,
  top = '16px',
  right = '16px'
}: SafariCloseButtonAbsoluteProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    // Detectamos si estamos en Safari
    const isSafari = 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g);
    
    if (buttonRef.current) {
      // Aplicamos estilos extremadamente agresivos
      const button = buttonRef.current;
      
      // Estos estilos se aplican siempre para garantizar consistencia
      button.style.position = 'absolute';
      button.style.top = top;
      button.style.right = right;
      button.style.zIndex = '999';
      
      if (isSafari) {
        // Estilos extra específicos para Safari
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.width = `${iconSize + 8}px`;
        button.style.height = `${iconSize + 8}px`;
        button.style.padding = '0';
        button.style.margin = '0';
        button.style.lineHeight = '1';
        button.style.borderRadius = '4px';
        button.style.background = 'transparent';
        
        // Encontramos el SVG y le aplicamos estilos específicos
        const svgElement = button.querySelector('svg');
        if (svgElement) {
          svgElement.style.display = 'block';
          svgElement.style.visibility = 'visible';
          svgElement.style.width = `${iconSize}px`;
          svgElement.style.height = `${iconSize}px`;
          svgElement.style.minWidth = `${iconSize}px`;
          svgElement.style.minHeight = `${iconSize}px`;
          svgElement.style.margin = '0 auto';
          svgElement.style.padding = '0';
          svgElement.style.transform = 'none';
          svgElement.style.position = 'static';
        }
      }
    }
  }, [iconSize, top, right]);
  
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`safari-close-button-abs absolute z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground ${className}`}
      aria-label="Close"
      type="button"
      style={{
        position: 'absolute',
        top,
        right,
        zIndex: 999
      }}
    >
      <X className="h-3.5 w-3.5" />
      <span className="sr-only">Close</span>
    </button>
  );
} 