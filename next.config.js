const path = require('path');

/** @type {import('next').NextConfig} */
const outputFileTracingRoot = process.env.NEXT_OUTPUT_FILE_TRACING_ROOT
  ? path.resolve(process.env.NEXT_OUTPUT_FILE_TRACING_ROOT)
  : __dirname;

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    outputFileTracingRoot,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
