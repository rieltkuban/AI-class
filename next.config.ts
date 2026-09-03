import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // output: 'standalone' намеренно выключен — см. промпт, п. 3.1.
};

export default nextConfig;
