"use client"

import { useEffect, useState } from 'react'

export function useSafariDetection() {
  const [isSafari, setIsSafari] = useState(false)

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof navigator !== 'undefined' && typeof document !== 'undefined') {
      const userAgent = navigator.userAgent
      const isSafariBrowser = 
        userAgent.match(/AppleWebKit\/[\d.]+/g) &&
        userAgent.match(/Version\/[\d.]+.*Safari/) &&
        !userAgent.match(/Chrome\/[\d.]+/g) &&
        !userAgent.match(/Chromium\/[\d.]+/g) &&
        !userAgent.match(/Edge\/[\d.]+/g) &&
        !userAgent.match(/Firefox\/[\d.]+/g)
      
      setIsSafari(!!isSafariBrowser)
      
      // Agregar clase CSS al html para reglas específicas de Safari inmediatamente
      if (isSafariBrowser) {
        document.documentElement.classList.add('safari')
        console.log('Safari detected - applying fixes')
      } else {
        document.documentElement.classList.remove('safari')
      }
    }
  }, [])

  return isSafari
}

// Hook para aplicar fixes automáticamente a elementos
export function useSafariIconFix(
  elementRef: React.RefObject<HTMLElement>, 
  options: {
    iconSize?: number
    position?: 'left' | 'right'
    isButton?: boolean
  } = {}
) {
  const isSafari = useSafariDetection()
  const { iconSize = 16, position = 'left', isButton = false } = options

  useEffect(() => {
    if (!isSafari || !elementRef.current) return

    const element = elementRef.current
    
    // Aplicar estilos al contenedor
    element.style.position = isButton ? 'relative' : 'absolute'
    element.style.display = 'flex'
    element.style.alignItems = 'center'
    element.style.justifyContent = 'center'
    
    if (!isButton) {
      element.style.top = '50%'
      element.style.transform = 'translateY(-50%)'
      element.style[position] = '12px'
      element.style.zIndex = '10'
    }
    
    // Aplicar estilos a todos los SVG
    const svgElements = element.querySelectorAll('svg')
    svgElements.forEach(svg => {
      svg.style.display = 'block'
      svg.style.visibility = 'visible'
      svg.style.opacity = '1'
      svg.style.width = `${iconSize}px`
      svg.style.height = `${iconSize}px`
      svg.style.minWidth = `${iconSize}px`
      svg.style.minHeight = `${iconSize}px`
      svg.style.position = 'static'
      svg.style.margin = '0 auto'
    })
  }, [isSafari, iconSize, position, isButton])

  return isSafari
} 