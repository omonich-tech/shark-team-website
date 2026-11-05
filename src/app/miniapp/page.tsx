import type { Metadata } from "next";
import { MiniAppDashboard } from "@/components/miniapp/miniapp-dashboard";
import "./miniapp.css";

export const metadata: Metadata = {
  title: "SHARK TEAM · Mini App",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default function MiniAppPage() {
  return <MiniAppDashboard />;
}
