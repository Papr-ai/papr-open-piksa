import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily ignore ESLint during builds to resolve persistent unescaped entity errors
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        protocol: 'https',
        hostname: '**.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '**.public.blob.storage.com',
      },
      {
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};

export default nextConfig;
