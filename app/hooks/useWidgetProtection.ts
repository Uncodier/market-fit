"use client"

import { useEffect, useState } from 'react'

/**
 * Hook para proteger widgets contra ejecuciones innecesarias
 * Verifica que el widget esté en la ruta correcta y montado en el DOM
 */
export function useWidgetProtection(widgetName: string, requiredRoute: string = '/dashboard') {
  const [shouldExecute, setShouldExecute] = useState(false)

  useEffect(() => {
    // Check if we're in the right route
    if (typeof window !== 'undefined' && !window.location.pathname.includes(requiredRoute)) {
      console.log(`[${widgetName}] Not in ${requiredRoute} route, widget protected`);
      setShouldExecute(false);
      return;
    }

    // Check if this component is actually visible in the DOM
    if (typeof document !== 'undefined') {
      const widgetElements = document.querySelectorAll(`[data-widget="${widgetName}"]`);
      if (widgetElements.length === 0) {
        console.log(`[${widgetName}] Widget not found in DOM, widget protected`);
        setShouldExecute(false);
        return;
      }
    }

    setShouldExecute(true);
  }, [widgetName, requiredRoute]);

  return shouldExecute;
} 