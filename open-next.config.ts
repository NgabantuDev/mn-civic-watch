import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incrementalCache override — this app is a single fully static page
// (no dynamic routes, no ISR, no server-side fetch caching), so there's
// nothing for it to cache. The R2-backed cache Cloudflare's autoconfig
// added by default was producing repeated 503-retry writes in production
// for zero benefit.
export default defineCloudflareConfig();
