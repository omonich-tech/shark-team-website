import type { Metadata } from "next";
import "./globals.css";

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
);

const googleSiteVerification =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() || null;
const yandexSiteVerification =
  process.env.YANDEX_SITE_VERIFICATION?.trim() || null;

export const metadata: Metadata = {
  metadataBase,
  title: "SHARK TEAM",
  description: "Children's sports sections in Tashkent",
  applicationName: "SHARK TEAM",
  category: "sports"
};

const themeInitScript = `
  try {
    const saved = localStorage.getItem("shark-theme");
    const theme =
      saved === "light" || saved === "dark"
        ? saved
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch {}
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {googleSiteVerification ? (
          <meta
            name="google-site-verification"
            content={googleSiteVerification}
          />
        ) : null}
        {yandexSiteVerification ? (
          <meta name="yandex-verification" content={yandexSiteVerification} />
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
