/** @type {import('next').NextConfig} */
const apiTarget = String(
  process.env.API_PROXY_TARGET || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://perfume-backend-wlk8.onrender.com'
).replace(/\/+$/, '')

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next-dev',
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1'
      },
      {
        protocol: 'https',
        hostname: 'perfume-backend-wlk8.onrender.com'
      }
    ]
  },
  experimental: {
    optimizePackageImports: ['leaflet']
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/media/:path*', destination: `${apiTarget}/media/:path*` },
      { source: '/admin/media/:path*', destination: `${apiTarget}/admin/media/:path*` }
    ]
  }
  ,
  // No custom redirects for /my-orders so the in-repo page can render normally.
  async redirects() {
    return []
  }
}
module.exports = nextConfig
