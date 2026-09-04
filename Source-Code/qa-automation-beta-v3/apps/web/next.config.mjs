/** @type {import('next').NextConfig} */
// Build mode:
//   default              → standard Next.js dev/build (with /api → FastAPI rewrites)
//   NEXT_BUILD_STATIC=1  → static HTML export to ./out/ for Databricks Apps deploy
//                          (rewrites disabled — frontend hits /api on the same origin
//                           served by the FastAPI StaticFiles mount in prod)
const isStaticExport = process.env.NEXT_BUILD_STATIC === "1";

const baseConfig = {
  reactStrictMode: true,
};

const exportConfig = {
  ...baseConfig,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Disable SWC minifier for the static-export build: the SWC minifier mis-parses
  // Windows paths that contain underscore-adjacent-digit sequences (Next.js 14 bug).
  // Bundle size is irrelevant for an internal Databricks tool.
  webpack: (config, { dev }) => {
    if (!dev) config.optimization.minimize = false;
    return config;
  },
};

const devConfig = {
  ...baseConfig,
  experimental: { typedRoutes: true },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default isStaticExport ? exportConfig : devConfig;
