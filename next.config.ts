import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
// IndexNow keys are public proof-of-control values, not credentials.
const indexNowKey =
  process.env.INDEXNOW_KEY?.trim() || "6da185bf00fc85720816942a603c56b5";
const hasValidIndexNowKey = /^[A-Za-z0-9-]{8,128}$/.test(indexNowKey);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)"
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://*.posthog.com",
      "connect-src 'self' https:",
      "worker-src 'self' blob: data:",
      "form-action 'self' https://checkout.paycom.uz https://test.paycom.uz"
    ].join("; ")
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains"
        }
      ]
    : [])
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      ...(hasValidIndexNowKey
        ? [
            {
              source: `/${indexNowKey}.txt`,
              destination: `/api/indexnow-key/${indexNowKey}`
            }
          ]
        : []),
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*"
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*"
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
