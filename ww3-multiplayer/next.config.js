/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Transpile three.js for SSR compatibility
  transpilePackages: ['three'],
};

module.exports = nextConfig;
