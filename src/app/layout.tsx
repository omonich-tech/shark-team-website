import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHARK TEAM",
  description: "Children's sports sections in Tashkent"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
