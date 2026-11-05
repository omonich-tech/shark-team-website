import type { Metadata } from "next";
import Script from "next/script";
import { MiniAppDashboard } from "@/components/miniapp/miniapp-dashboard";
import "./miniapp.css";

export const metadata: Metadata = {
  title: "SHARK TEAM · Mini App",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function MiniAppPage({
  searchParams
}: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" /><MiniAppDashboard initialRole={params.role === "coach" ? "coach" : "parent"} /></>;
}
