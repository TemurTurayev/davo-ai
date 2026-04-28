import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  // typedRoutes disabled — strict mode breaks dynamic href={string} usage everywhere.
  // Re-enable post-MVP after refactoring all Link components to use Route type.
  typedRoutes: false,
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
