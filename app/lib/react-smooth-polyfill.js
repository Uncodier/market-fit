"use client";

// Este archivo proporciona un polyfill para la biblioteca react-smooth
// Que es requerida por recharts

import React from 'react';

// Implementación simplificada de Animate de react-smooth
// Esta es una versión mínima que solo pasa los children sin animación
const Animate = ({ children, ...props }) => {
  return React.Children.only(children);
};

// Añadimos cualquier propiedad estática que pueda ser utilizada
Animate.defaultProps = {
  duration: 0,
  easing: 'linear',
  isActive: true,
};

// Exportar como defaultExport y también como named export por compatibilidad
export { Animate };
export default Animate; 