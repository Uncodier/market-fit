'use client';

import React, { useEffect, useRef } from 'react';
import { Settings } from '@/app/components/ui/icons';
import { NavigationLink } from '@/app/components/navigation/NavigationLink';
import { cn } from '@/lib/utils';
import { EmojiIcon } from '@/app/components/navigation/MenuItem';

interface SafariSettingsLinkProps {
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  iconSize?: number;
  label?: string;
  isCollapsed?: boolean;
  emoji?: string;
  isActive?: boolean;
}

export function SafariSettingsLink({
  href = '/settings',
  onClick,
  className = '',
  iconSize = 16.2,
  label = 'Settings',
  isCollapsed = false,
  emoji,
  isActive = false,
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
      if (isCollapsed) {
        link.style.justifyContent = 'center';
        link.style.width = '32px';
        link.style.height = '32px';
        link.style.padding = '0';
        link.style.gap = '0';
      } else {
        link.style.justifyContent = 'flex-start';
        link.style.width = '100%';
        link.style.height = '32px';
        link.style.paddingLeft = '9.7px';
        link.style.paddingRight = '9.7px';
        link.style.paddingTop = '6.5px';
        link.style.paddingBottom = '6.5px';
        link.style.gap = '9.7px';
      }
      
      // Encuentra todos los elementos internos
      const iconContainer = link.querySelector('div:first-child');
      const svgElement = link.querySelector('svg');
      const textContainer = Array.from(link.querySelectorAll('div')).find(div => 
        div !== iconContainer && div.textContent?.trim() === label
      );
      const textSpan = link.querySelector('span');
      
      // Asegurar que el contenedor del icono tenga el tamaño correcto
      if (iconContainer) {
        iconContainer.style.display = 'flex';
        iconContainer.style.alignItems = 'center';
        iconContainer.style.justifyContent = 'center';
        // Siempre usar 24px cuando no está colapsado (igual que MenuItem)
        iconContainer.style.width = isCollapsed ? '32px' : '24px';
        iconContainer.style.height = isCollapsed ? '32px' : '24px';
        iconContainer.style.flexShrink = '0';
        iconContainer.style.margin = '0';
      }
      
      // Asegurar que el SVG tenga el tamaño correcto (solo si no hay emoji)
      if (svgElement && !emoji) {
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
      
      // Asegurar que el contenedor del texto tenga el estilo correcto
      if (textContainer) {
        if (isCollapsed) {
          textContainer.style.display = 'none';
        } else {
          textContainer.style.display = 'flex';
          textContainer.style.flexDirection = 'column';
          textContainer.style.minWidth = '0';
          textContainer.style.fontSize = '11.3px';
        }
      }
      
      // Asegurar que el span del texto tenga el estilo correcto
      if (textSpan) {
        if (isCollapsed) {
          textSpan.style.display = 'none';
        } else {
          textSpan.style.display = 'block';
          textSpan.style.overflow = 'hidden';
          textSpan.style.textOverflow = 'ellipsis';
          textSpan.style.whiteSpace = 'nowrap';
        }
      }
    }
  }, [iconSize, href, isCollapsed, emoji]);
  
  return (
    <NavigationLink
      ref={linkRef}
      href={href}
      onClick={onClick}
      className={cn(
        "safari-settings-link",
        isCollapsed ? "collapsed" : "",
        "flex items-center text-sm transition-all duration-200 relative group hover:scale-105 active:scale-95",
        isCollapsed 
          ? isActive 
            ? "rounded-full justify-center h-[32px] w-[32px]" 
            : "rounded-md justify-center h-[32px] w-[32px]"
          : "rounded-md justify-start h-[32px]",
        isActive
          ? "bg-primary text-primary-foreground [&_svg]:text-primary-foreground [&_span]:text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:shadow-accent/20",
        className
      )}
      style={{ 
        paddingLeft: isCollapsed ? '0px' : '9.7px', 
        paddingRight: isCollapsed ? '0px' : '9.7px', 
        paddingTop: isCollapsed ? '0px' : '6.5px', 
        paddingBottom: isCollapsed ? '0px' : '6.5px',
        gap: isCollapsed ? '0px' : '9.7px',
        fontSize: '11.3px'
      }}
    >
      <div className={cn(
        "flex items-center justify-center safari-icon-fix",
        isCollapsed ? "w-[32px] h-[32px] mx-auto" : "w-[24px] h-[24px]",
        "settings-icon-container"
      )}>
        {emoji ? (
          <EmojiIcon emoji={emoji} isActive={isActive} isCollapsed={isCollapsed} />
        ) : (
          <Settings className="h-[16.2px] w-[16.2px] shrink-0" />
        )}
      </div>
      {!isCollapsed && (
        <div
          className={cn(
            "flex flex-col min-w-0"
          )}
          style={{ fontSize: '11.3px' }}
        >
          <span className="truncate">{label}</span>
        </div>
      )}
    </NavigationLink>
  );
} 