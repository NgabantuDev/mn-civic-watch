import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MapLibre owns a WebGL context + worker pool per instance; React
  // StrictMode's dev-only double-mount (create -> remove -> create) was
  // leaving the map stuck mid-style-load, so it's off for this app.
  reactStrictMode: false,
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
