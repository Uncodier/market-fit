#!/bin/bash

# Script de despliegue para Market Fit

echo "=== Iniciando despliegue de Market Fit ==="

# Establecer variables de entorno
export NODE_ENV=production
export NEXT_PUBLIC_RUNTIME=nodejs
export NEXT_PRIVATE_TARGET=server
export NEXT_RUNTIME=nodejs

# Limpiar la caché de Next.js
echo "Limpiando caché..."
rm -rf .next
rm -rf node_modules/.cache

# Instalar dependencias
echo "Instalando dependencias..."
npm install --no-save

# Asegurarse de que todas las dependencias necesarias estén instaladas
echo "Instalando dependencias críticas..."
npm install --save tailwindcss postcss autoprefixer

# Construir la aplicación directamente sin precalentar
echo "Construyendo para producción en modo servidor..."
NODE_ENV=production NEXT_RUNTIME=nodejs npx next build

# Verificar si la construcción fue exitosa
if [ $? -eq 0 ]; then
  echo "Construcción exitosa. Iniciando servidor..."
  # Iniciar servidor
  NODE_ENV=production npx next start
else
  echo "Error durante la construcción."
  exit 1
fi 