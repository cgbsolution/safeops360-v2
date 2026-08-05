/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Production: cache-friendly + smaller bundles
  compress: true,
  poweredByHeader: false,
  // Self-contained server build for the on-prem Docker image (deploy/Dockerfile.frontend
  // sets DOCKER_BUILD=1). Left undefined on Vercel so the existing cloud build is
  // unaffected.
  ...(process.env.DOCKER_BUILD ? { output: "standalone" } : {}),
  // Skips re-running ESLint on every build. Lint is run in CI / pre-commit.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }]
  },
  async headers() {
    // Baseline security headers on every response. CSP is intentionally
    // omitted here — a strict Content-Security-Policy needs per-route testing
    // against Next.js inline styles/scripts and should be rolled out as a
    // Report-Only policy first, then enforced.
    const securityHeaders = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
      { key: "X-DNS-Prefetch-Control", value: "on" }
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Tree-shake icon + Radix barrel imports. Without this every page that
    // imports a single icon from lucide-react pulls thousands of others into
    // the dev build, which is a major reason `next dev` feels slow on
    // first-visit to a route. Production bundles also shrink noticeably.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-avatar",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "date-fns",
      "recharts"
    ]
  }
};

module.exports = nextConfig;
