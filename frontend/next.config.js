/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
