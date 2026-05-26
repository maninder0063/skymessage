import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@skymessage/ui', '@skymessage/shared', '@skymessage/types'],
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
  poweredByHeader: false,
};

export default config;
