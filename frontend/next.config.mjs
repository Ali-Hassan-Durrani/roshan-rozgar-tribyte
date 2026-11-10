/** @type {import('next').NextConfig} */
// Rewrites are fixed at build time: changing BACKEND_URL needs a rebuild (redeploy on Render).
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");

const nextConfig = {
  // Lets a production build run beside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Same-origin proxy so httpOnly auth cookies stay first-party (plan §2).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
