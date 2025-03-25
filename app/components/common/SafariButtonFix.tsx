'use client';

import React, { useEffect, useRef, ReactNode } from 'react';
import { Button, ButtonProps } from '@/app/components/ui/button';

interface SafariButtonFixProps extends ButtonProps {
  children: ReactNode;
  iconSize?: number;
}

export function SafariButtonFix({ 
  children, 
  iconSize = 16, 
  className = '',
  ...props 
}: SafariButtonFixProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    // Detectamos si estamos en Safari
    const isSafari = 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g);
    
    if (isSafari && buttonRef.current) {
      // Aplicamos estilos al botón
      const button = buttonRef.current;
      button.style.display = 'inline-flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.position = 'relative';
      
      // Encontramos cualquier SVG dentro del botón
      const svgElements = button.querySelectorAll('svg');
      svgElements.forEach(svg => {
        // Aplicamos estilos al SVG
        svg.style.display = 'block';
        svg.style.visibility = 'visible';
        svg.style.width = `${iconSize}px`;
        svg.style.height = `${iconSize}px`;
        svg.style.minWidth = `${iconSize}px`;
        svg.style.minHeight = `${iconSize}px`;
        svg.style.margin = 'auto';
        
        // Si hay un span hermano, aseguramos que el layout sea correcto
        const parentElement = svg.parentElement;
        if (parentElement && parentElement.tagName === 'SPAN') {
          parentElement.style.display = 'inline-flex';
          parentElement.style.alignItems = 'center';
          parentElement.style.justifyContent = 'center';
        }
      });
    }
  }, [iconSize]);
  
  return (
    <Button
      ref={buttonRef}
      className={`safari-button-fix ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
} 