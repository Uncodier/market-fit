"use client";

// Este archivo proporciona un polyfill para la biblioteca react-smooth
// Que es requerida por recharts

import React from 'react';

// Implementación simplificada de Animate de react-smooth
// Esta es una versión modificada que maneja múltiples children o ninguno
const Animate = ({ children, ...props }) => {
  // If children is null or undefined, return null
  if (!children) {
    return null;
  }

  // If React.Children.count(children) is 0, return null
  if (React.Children.count(children) === 0) {
    return null;
  }

  // If it's a single child, return it directly
  if (React.Children.count(children) === 1) {
    return children;
  }

  // If multiple children, wrap them in a fragment
  return <React.Fragment>{children}</React.Fragment>;
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