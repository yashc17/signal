import type { NextConfig } from "next";

// Static export so the whole site can be hosted on GitHub Pages / any CDN.
// Set BASE_PATH=/signal when deploying to https://<user>.github.io/signal.
const basePath = process.env.BASE_PATH || "";

const config: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default config;
