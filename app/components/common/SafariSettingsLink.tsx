'use client';

import React, { useEffect, useRef } from 'react';
import { Settings } from '@/app/components/ui/icons';
import Link from 'next/link';

interface SafariSettingsLinkProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  iconSize?: number;
  label?: string;
}

export function SafariSettingsLink({
  href = '/settings',
  onClick,
  className = '',
  iconSize = 25,
  label = 'Settings'
}: SafariSettingsLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  
  useEffect(() => {
    // Detectamos si estamos en Safari
    const isSafari = 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g);
    
    if (isSafari && linkRef.current) {
      // Aplicamos estilos exactamente iguales al MenuItem normal
      const link = linkRef.current;
      
      // Estilos para el contenedor principal - igual que los otros MenuItems
      link.style.display = 'flex';
      link.style.alignItems = 'center';
      link.style.gap = '12px';
      link.style.width = '100%';
      link.style.height = '39px';
      link.style.position = 'relative';
      link.style.padding = '8px 12px';
      link.style.borderRadius = '4px';
      
      // Encuentra todos los elementos internos
      const iconContainer = link.querySelector('div');
      const svgElement = link.querySelector('svg');
      const textSpan = link.querySelector('span');
      
      // Asegurar que el contenedor del icono tenga el tamaño correcto
      if (iconContainer) {
        iconContainer.style.display = 'flex';
        iconContainer.style.alignItems = 'center';
        iconContainer.style.justifyContent = 'center';
        iconContainer.style.width = '25px';
        iconContainer.style.height = '25px';
        iconContainer.style.flexShrink = '0';
        iconContainer.style.margin = '0';
      }
      
      // Asegurar que el SVG tenga el tamaño correcto
      if (svgElement) {
        svgElement.style.display = 'block';
        svgElement.style.visibility = 'visible';
        svgElement.style.width = '25px';
        svgElement.style.height = '25px';
        svgElement.style.minWidth = '25px';
        svgElement.style.minHeight = '25px';
        svgElement.style.flexShrink = '0';
        svgElement.style.position = 'static';
        svgElement.style.margin = '0';
      }
      
      // Asegurar que el texto tenga el estilo correcto
      if (textSpan) {
        textSpan.style.display = 'block';
        textSpan.style.flexGrow = '1';
        textSpan.style.textAlign = 'left';
        textSpan.style.margin = '0';
        textSpan.style.padding = '0';
        textSpan.style.whiteSpace = 'nowrap';
        textSpan.style.overflow = 'hidden';
        textSpan.style.textOverflow = 'ellipsis';
      }
    }
  }, [iconSize, href]);
  
  return (
    <Link
      ref={linkRef}
      href={href}
      onClick={onClick}
      className={`safari-settings-link flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative ${className}`}
    >
      <div className="flex items-center justify-center w-[25px] h-[25px] shrink-0">
        <Settings className="h-[25px] w-[25px]" />
      </div>
      <span className="truncate">{label}</span>
    </Link>
  );
} 