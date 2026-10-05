import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHARK TEAM",
  description: "Children's sports sections in Tashkent"
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
