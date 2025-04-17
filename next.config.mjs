/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'localhost',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'googleusercontent.com',
      's.gravatar.com',
      'avatar.vercel.sh',
      'github.com'
    ]
  },
  experimental: {
    // Habilitar la opción forceSwcTransforms
    forceSwcTransforms: true
  },
  // Deshabilitar la prerrenderización estática para evitar errores
  // con useSearchParams
  output: 'export',
  // Configurar para ignorar errores de compilación
  onDemandEntries: {
    // período (en ms) donde el servidor esperará a una recarga
    // si no hay accesos al punto de entrada de una página
    maxInactiveAge: 25 * 1000,
    // número de páginas que deben mantenerse en memoria simultáneamente
    pagesBufferLength: 5,
  }
};

export default nextConfig; 