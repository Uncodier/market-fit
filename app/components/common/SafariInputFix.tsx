'use client';

import React, { useEffect, useRef, ReactNode } from 'react';
import { Input, InputProps } from '@/app/components/ui/input';

interface SafariInputFixProps extends InputProps {
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  iconSize?: number;
  wrapperClassName?: string;
}

export function SafariInputFix({
  icon,
  iconPosition = 'right',
  iconSize = 14.4,
  wrapperClassName = '',
  className = '',
  ...props
}: SafariInputFixProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iconContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Detectamos si estamos en Safari
    const isSafari = 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g);
    
    if (isSafari) {
      // Aplicamos estilos al contenedor
      if (wrapperRef.current) {
        wrapperRef.current.style.position = 'relative';
        wrapperRef.current.style.display = 'block';
      }
      
      // Aplicamos estilos al contenedor de iconos
      if (iconContainerRef.current) {
        iconContainerRef.current.style.position = 'absolute';
        iconContainerRef.current.style[iconPosition] = '10px';
        iconContainerRef.current.style.top = '50%';
        iconContainerRef.current.style.transform = 'translateY(-50%)';
        iconContainerRef.current.style.display = 'flex';
        iconContainerRef.current.style.alignItems = 'center';
        iconContainerRef.current.style.justifyContent = 'center';
        iconContainerRef.current.style.zIndex = '10';
        
        // Encontramos cualquier SVG dentro del contenedor
        const svgElements = iconContainerRef.current.querySelectorAll('svg');
        svgElements.forEach(svg => {
          // Aplicamos estilos al SVG
          svg.style.display = 'block';
          svg.style.visibility = 'visible';
          svg.style.width = `${iconSize}px`;
          svg.style.height = `${iconSize}px`;
          svg.style.minWidth = `${iconSize}px`;
          svg.style.minHeight = `${iconSize}px`;
          svg.style.margin = 'auto';
        });
      }
    }
  }, [iconPosition, iconSize]);
  
  // Aplicamos el padding adecuado según la posición del icono
  const inputStyles = icon 
    ? { 
        paddingLeft: iconPosition === 'left' ? `${iconSize + 20}px` : undefined,
        paddingRight: iconPosition === 'right' ? `${iconSize + 20}px` : undefined,
      }
    : {};
  
  return (
    <div 
      ref={wrapperRef} 
      className={`safari-input-wrapper relative ${wrapperClassName}`}
    >
      <Input
        className={`safari-input-fix ${className}`}
        style={inputStyles}
        {...props}
      />
      {icon && (
        <div 
          ref={iconContainerRef}
          className={`safari-input-icon-container ${iconPosition === 'left' ? 'left-2' : 'right-2'}`}
        >
          {icon}
        </div>
      )}
    </div>
  );
} 