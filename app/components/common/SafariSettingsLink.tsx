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
  isCollapsed?: boolean;
}

export function SafariSettingsLink({
  href = '/settings',
  onClick,
  className = '',
  iconSize = 18,
  label = 'Settings',
  isCollapsed = false,
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
      link.style.position = 'relative';
      link.style.borderRadius = '4px';
      if (isCollapsed) {
        link.style.justifyContent = 'center';
        link.style.width = '35px';
        link.style.height = '35px';
        link.style.padding = '0';
        link.style.gap = '0';
      } else {
        link.style.justifyContent = 'flex-start';
        link.style.width = '100%';
        link.style.height = '35px';
        link.style.padding = '8px 12px';
        link.style.gap = '10.8px';
      }
      
      // Encuentra todos los elementos internos
      const iconContainer = link.querySelector('div');
      const svgElement = link.querySelector('svg');
      const textSpan = link.querySelector('span');
      
      // Asegurar que el contenedor del icono tenga el tamaño correcto
      if (iconContainer) {
        iconContainer.style.display = 'flex';
        iconContainer.style.alignItems = 'center';
        iconContainer.style.justifyContent = 'center';
        iconContainer.style.width = isCollapsed ? '35px' : '23px';
        iconContainer.style.height = '23px';
        iconContainer.style.flexShrink = '0';
        iconContainer.style.margin = '0';
      }
      
      // Asegurar que el SVG tenga el tamaño correcto
      if (svgElement) {
        svgElement.style.display = 'block';
        svgElement.style.visibility = 'visible';
        svgElement.style.width = `${iconSize}px`;
        svgElement.style.height = `${iconSize}px`;
        svgElement.style.minWidth = `${iconSize}px`;
        svgElement.style.minHeight = `${iconSize}px`;
        svgElement.style.flexShrink = '0';
        svgElement.style.position = 'static';
        svgElement.style.margin = '0';
      }
      
      // Asegurar que el texto tenga el estilo correcto
      if (textSpan) {
        if (isCollapsed) {
          textSpan.style.display = 'none';
        } else {
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
    }
  }, [iconSize, href, isCollapsed]);
  
  return (
    <Link
      ref={linkRef}
      href={href}
      onClick={onClick}
      className={`safari-settings-link ${isCollapsed ? 'collapsed' : ''} flex items-center rounded-md text-sm transition-colors relative ${className}`}
    >
      <div className="flex items-center justify-center w-[23px] h-[23px] shrink-0">
        <Settings className="h-[18px] w-[18px]" />
      </div>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
} 