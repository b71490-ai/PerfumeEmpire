/** @type {import('next').NextConfig} */
const apiTarget = String(
  process.env.API_PROXY_TARGET || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100'
).replace(/\/+$/, '')

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next-dev',
  images: {
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
      }
    ]
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/media/:path*', destination: `${apiTarget}/media/:path*` },
      { source: '/admin/media/:path*', destination: `${apiTarget}/admin/media/:path*` }
    ]
  }
  ,
  async redirects() {
    return [
      { source: '/my-orders', destination: '/orders', permanent: true },
      { source: '/my-orders/:path*', destination: '/orders/:path*', permanent: true }
    ]
  }
}
module.exports = nextConfig
