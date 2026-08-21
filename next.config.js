const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurar assetPrefix en producción para que el proxy en www cargue los assets desde app.makinari.com
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://app.makinari.com' : undefined,
  
  // Mitigate ECONNRESET in dev: Node 20+ fetch uses keep-alive; stale connections cause resets.
  ...(process.env.NODE_ENV === 'development' && {
    httpAgentOptions: { keepAlive: false },
    httpsAgentOptions: { keepAlive: false }
  }),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'rnjgeloamtszdjplmqxy.supabase.co' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'googleusercontent.com' },
      { protocol: 'https', hostname: 's.gravatar.com' },
      { protocol: 'https', hostname: 'avatar.vercel.sh' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'cloudfront.cdn.uncodie.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
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
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://files.uncodie.com https://backend.uncodie.com https://app.makinari.com;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.makinari.com;
              img-src 'self' data: blob: https: http://localhost:3001;
              font-src 'self' data: https://fonts.gstatic.com https://app.makinari.com;
              connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in http://localhost:3001 http://192.168.0.38:3001 http://192.168.0.61:3001 http://192.168.87.79:3001 http://192.168.87.25:3001 http://192.168.87.246:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:* http://192.168.87.174:* http://192.168.87.174 https://192.168.87.174:* http://192.168.87.180:* http://192.168.87.180 https://192.168.87.180:* https://tu-api-real.com https://backend.aimarket.fit https://backend.uncodie.com https://api.uncodie.com https://backend.makinari.com https://db.makinari.com wss://db.makinari.com https://app.makinari.com https://www.makinari.com https://ipapi.co https://nominatim.openstreetmap.org https://api.stripe.com https://*.stripe.com;
              frame-src 'self' https://*.supabase.co https://rnjgeloamtszdjplmqxy.supabase.co https://docs.google.com https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.scrapybara.com https://*.vercel.app https://*.makinari.com https://*.preview.makinari.com https://www.openstreetmap.org;
              media-src 'self' blob: https://files.uncodie.com https://*.supabase.co https://rnjgeloamtszdjplmqxy.supabase.co https://db.makinari.com;
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
  // Keep in sync with commercial-site/next.config.js (www → app proxy).
  // Only active when MARKET_FIT_ORIGIN is set so this app deploy does not
  // proxy to itself.
  async rewrites() {
    const app = process.env.MARKET_FIT_ORIGIN
    if (!app) return []
    const page = (route) => [
      { source: route, destination: `${app}${route}` },
      { source: `${route}/:path*`, destination: `${app}${route}/:path*` },
    ]
    return [
      ...page('/auth'),
      ...page('/shop'),
      ...page('/marketplace'),
      ...page('/cart'),
      ...page('/buyer'),
      ...page('/book'),
      ...page('/so'),
      ...page('/q'),
      ...page('/i'),
      ...page('/vb'),
      ...page('/profile'),
      { source: '/api/stripe/checkout/order', destination: `${app}/api/stripe/checkout/order` },
      { source: '/api/fx/rates', destination: `${app}/api/fx/rates` },
      { source: '/api/geocode', destination: `${app}/api/geocode` },
    ]
  },
  // Next 16 reads serverActions from experimental (top-level is ignored).
  // www proxies shop/commerce to the app deployment; Origin is www while
  // x-forwarded-host is app — allow www so Server Actions are not aborted.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'www.makinari.com',
        'makinari.com',
        'app.makinari.com',
        'demo.makinari.com',
        '*.preview.makinari.com',
      ],
    },
  },
}

module.exports = nextConfig 