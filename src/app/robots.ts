import type { MetadataRoute } from "next";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin-login",
        "/coach",
        "/coach-login",
        "/api",
        "/ru/trial",
        "/uz/trial"
      ]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
