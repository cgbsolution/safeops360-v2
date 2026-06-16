/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Production: cache-friendly + smaller bundles
  compress: true,
  poweredByHeader: false,
  // Skips re-running ESLint on every build. Lint is run in CI / pre-commit.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }]
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
