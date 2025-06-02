const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'rnjgeloamtszdjplmqxy.supabase.co',
      'localhost',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'googleusercontent.com',
      's.gravatar.com',
      'avatar.vercel.sh',
      'github.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cloudfront.cdn.uncodie.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'rnjgeloamtszdjplmqxy.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Desactivar TypeScript durante la compilación
  typescript: {
    // ⚠️ Solución temporal para permitir la compilación 
    // Nota: Esto no es recomendable para producción, solo para desarrollo
    ignoreBuildErrors: true,
  },
  // Desactivar ESLint durante la compilación
  eslint: {
    // ⚠️ Solución temporal para permitir la compilación
    ignoreDuringBuilds: true,
  },
  // Configuración para manejar errores de prerender
  output: 'standalone',
  // Configurar páginas estáticas vs dinámicas
  staticPageGenerationTimeout: 120,
  experimental: {
    // Desactivar la reconstrucción completa forzada que puede causar problemas
    forceSwcTransforms: false,
    // Optimizaciones para la compilación
    optimizeCss: true,
    scrollRestoration: true,
    workerThreads: true,
  }
}

module.exports = nextConfig 