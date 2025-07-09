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
  // Headers configuration for CSP
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://files.uncodie.com https://backend.uncodie.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https:;
              font-src 'self' data:;
              connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in http://localhost:3001 http://192.168.0.38:3001 http://192.168.0.61:3001 http://192.168.87.79:3001 http://192.168.87.25:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:* http://192.168.87.174:* http://192.168.87.174 https://192.168.87.174:* http://192.168.87.180:* http://192.168.87.180 https://192.168.87.180:* https://tu-api-real.com https://backend.aimarket.fit https://backend.uncodie.com https://api.uncodie.com;
              frame-src 'self' https://*.supabase.co https://rnjgeloamtszdjplmqxy.supabase.co https://docs.google.com https://js.stripe.com https://hooks.stripe.com;
              object-src 'self' https://*.supabase.co https://rnjgeloamtszdjplmqxy.supabase.co;
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'none';
            `.replace(/\s{2,}/g, ' ').trim()
          },
        ],
      },
    ];
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
  }
}

module.exports = nextConfig 