"use client"

import { IconWrapper, type IconProps } from "./icon-wrapper"

// Menu
export const Menu = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  </IconWrapper>
)

// LogIn
export const LogIn = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  </IconWrapper>
)

// LogOut
export const LogOut = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  </IconWrapper>
)

// ChevronDown
export const ChevronDown = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </IconWrapper>
)

// ChevronUp
export const ChevronUp = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  </IconWrapper>
)

// ChevronRight
export const ChevronRight = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </IconWrapper>
)

// ChevronLeft
export const ChevronLeft = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </IconWrapper>
)

// Search
export const Search = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  </IconWrapper>
)

// Filter
export const Filter = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  </IconWrapper>
)

// LayoutGrid
export const LayoutGrid = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  </IconWrapper>
)

// Home
export const Home = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  </IconWrapper>
)

// ExternalLink
export const ExternalLink = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  </IconWrapper>
)

// Circle
export const Circle = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  </IconWrapper>
)

// PanelLeftClose - Icono para cerrar/colapsar un panel lateral
export const PanelLeftClose = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  </IconWrapper>
)

// PanelLeftOpen - Icono para abrir/expandir un panel lateral
export const PanelLeftOpen = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  </IconWrapper>
)

// AlertTriangle
export const AlertTriangle = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.29 3.86L1.82 18C1.64538 18.3024 1.55296 18.6453 1.55296 18.9945C1.55296 19.3437 1.64538 19.6866 1.82 19.99C1.99332 20.2659 2.2418 20.4927 2.53638 20.6471C2.83097 20.8015 3.16103 20.8783 3.5 20.87H20.5C20.84 20.88 21.17 20.8 21.46 20.65C21.7626 20.4791 22.0053 20.2249 22.1591 19.919C22.3128 19.6131 22.3718 19.2695 22.3288 18.9287C22.2857 18.5879 22.1425 18.2652 21.92 18L13.4 3.86C13.2096 3.56611 12.9493 3.32312 12.6396 3.15448C12.33 2.98585 11.9826 2.89725 11.63 2.89725C11.2774 2.89725 10.93 2.98585 10.6204 3.15448C10.3107 3.32312 10.0504 3.56611 9.86 3.86L10.29 3.86Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 9V13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 17H12.01" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
)

// Clock
export const Clock = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
)

// AlertCircle
export const AlertCircle = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 8V12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 16H12.01" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
)

// Info
export const Info = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  </IconWrapper>
)

// Añadimos el icono para los tres puntos verticales
export const MoreVertical = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  </IconWrapper>
)

// MoreHorizontal
export const MoreHorizontal = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  </IconWrapper>
)

// ArrowRight
export const ArrowRight = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  </IconWrapper>
)

// ArrowLeft
export const ArrowLeft = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  </IconWrapper>
)

// ArrowUp
export const ArrowUp = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  </IconWrapper>
)

// ArrowDown
export const ArrowDown = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  </IconWrapper>
)

// ArrowUpRight
export const ArrowUpRight = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  </IconWrapper>
)

// GripHorizontal
export const GripHorizontal = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="1" />
      <circle cx="19" cy="9" r="1" />
      <circle cx="5" cy="9" r="1" />
      <circle cx="12" cy="15" r="1" />
      <circle cx="19" cy="15" r="1" />
      <circle cx="5" cy="15" r="1" />
    </svg>
  </IconWrapper>
)

export const PanelRightClose = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <path d="m8 9 3 3-3 3" />
    </svg>
  </IconWrapper>
)

export const PanelRightOpen = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <path d="m10 15-3-3 3-3" />
    </svg>
  </IconWrapper>
)

export const SplitSquareHorizontal = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3" />
      <path d="M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3" />
      <line x1="12" x2="12" y1="4" y2="20" />
    </svg>
  </IconWrapper>
)
