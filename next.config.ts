import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /** Permite HMR e recursos dev quando acessado pelo celular na LAN (ex.: http://192.168.0.16:3001). */
  allowedDevOrigins: ['192.168.0.16', 'localhost', '127.0.0.1'],
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
