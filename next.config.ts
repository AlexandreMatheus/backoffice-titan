import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /** Permite HMR e recursos dev quando acessado pelo celular na LAN (ex.: http://192.168.0.16:3001). */
  allowedDevOrigins: ['192.168.0.16', 'localhost', '127.0.0.1'],
  experimental: {
    serverActions: {
      bodySizeLimit: '150mb',
    },
    /** Sem isso o Next trunca o body em ~10 MB antes da rota /media. */
    proxyClientMaxBodySize: '150mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflare.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
};

export default nextConfig;
