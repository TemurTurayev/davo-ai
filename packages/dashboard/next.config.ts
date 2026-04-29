import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  // typedRoutes disabled — strict mode breaks dynamic href={string} usage everywhere.
  // Re-enable post-MVP after refactoring all Link components to use Route type.
  typedRoutes: false,
  // Forward /ai/* requests to the AI proxy on localhost:7860, which on Air is
  // a tiny FastAPI forwarder to Pro M4 Pro 192.168.68.112:7860 (real OWLv2 + YOLO
  // + Florence on Metal). Site stays at ailab.21cloud.uz, AI calls are
  // /ai/owlv2/detect, /ai/yolo/detect, etc. No DNS changes needed.
  async rewrites() {
    return [
      {
        source: "/ai/:path*",
        destination: "http://localhost:7860/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "spark-5.idrock.uz" },
      { protocol: "https", hostname: "212.13.234.30" },
      { protocol: "https", hostname: "*.t.me" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Required for Telegram Mini App embedding
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org https://*.t.me" },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
