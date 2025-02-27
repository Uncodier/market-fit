"use client";

// Este archivo proporciona un polyfill para la biblioteca aria-hidden
// que es requerida por Radix UI

/**
 * Implementación simplificada de hideOthers de aria-hidden
 * Esta función normalmente oculta todos los elementos excepto el elemento activo 
 * cuando se abre un modal o menú, para mejorar la accesibilidad.
 * 
 * @param {HTMLElement} element - El elemento que debe permanecer visible
 * @param {Object} options - Opciones adicionales
 * @returns {Function} - Función para restaurar la visibilidad
 */
export function hideOthers(element, options = {}) {
  // Esta es una implementación vacía que no hace nada
  // Solo está para que las importaciones funcionen
  // En una aplicación real, esta función ocultaría otros elementos del DOM
  return function restore() {
    // Esta función simula la restauración del estado original
  };
}

// Exportar también como objeto para compatibilidad con diferentes tipos de importaciones
export default {
  hideOthers
}; 