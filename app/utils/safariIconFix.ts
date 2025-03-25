'use client';

/**
 * Verifica si el navegador actual es Safari para aplicar correcciones específicas
 */
export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return Boolean(
    navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
    navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
    !navigator.userAgent.match(/Chrome\/[\d.]+/g)
  );
};

/**
 * Función para aplicar estilos específicos a un elemento SVG en Safari
 */
export const applySafariSvgFixes = (
  svgElement: SVGElement, 
  options: { 
    width?: number, 
    height?: number, 
    display?: string,
    position?: string
  } = {}
): void => {
  if (!isSafari() || !svgElement) return;
  
  const { 
    width = 16, 
    height = 16, 
    display = 'block',
    position = 'static'
  } = options;
  
  // Aplicamos los ajustes necesarios
  svgElement.style.display = display;
  svgElement.style.width = `${width}px`;
  svgElement.style.height = `${height}px`;
  svgElement.style.minWidth = `${width}px`;
  svgElement.style.minHeight = `${height}px`;
  svgElement.style.position = position;
  
  // Ajustamos también el contenedor padre si existe
  const parent = svgElement.parentElement;
  if (parent) {
    parent.style.display = 'inline-flex';
    parent.style.alignItems = 'center';
    parent.style.justifyContent = 'center';
  }
};

/**
 * Hook para aplicar correcciones de iconos en Safari cuando el componente se monta
 */
export const useSafariIconFix = (
  ref: React.RefObject<HTMLElement>,
  options?: { 
    width?: number, 
    height?: number,
    selector?: string,
    display?: string,
    position?: string,
    onlyIfBroken?: boolean
  }
): void => {
  if (typeof window === 'undefined') return;
  
  const {
    width = 16,
    height = 16,
    selector = 'svg',
    display = 'block',
    position = 'static',
    onlyIfBroken = true
  } = options || {};
  
  // Ejecutamos solo en Safari y cuando el componente está montado
  if (isSafari() && ref.current) {
    const svgElements = ref.current.querySelectorAll(selector);
    
    svgElements.forEach((svg) => {
      if (svg instanceof SVGElement) {
        // Si solo debemos arreglar iconos "rotos"
        if (onlyIfBroken) {
          const rect = svg.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          if (!isVisible) {
            applySafariSvgFixes(svg, { width, height, display, position });
          }
        } else {
          applySafariSvgFixes(svg, { width, height, display, position });
        }
      }
    });
  }
};

/**
 * Clase CSS para añadir a elementos que necesitan corrección en Safari
 */
export const SAFARI_ICON_CLASS = 'safari-icon-fix'; 