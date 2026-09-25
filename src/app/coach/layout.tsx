import type { Metadata } from "next";
import Link from "next/link";
import { CoachLogoutButton } from "@/components/coach/coach-logout-button";
import { requireCoachSession } from "@/server/coach/auth";

export const metadata: Metadata = {
  title: {
    default: "SHARK TEAM Coach",
    template: "%s | SHARK TEAM Coach"
  },
  robots: {
    index: false,
    follow: false
  }
};

export default async function CoachLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireCoachSession();
  const coachName = [session.coach.firstName, session.coach.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="coach-shell">
      <header className="coach-header">
        <div>
          <Link className="coach-brand" href="/coach">
            <span className="brand-mark">S</span>
            <span>SHARK TEAM</span>
          </Link>
          <span className="coach-user">{coachName}</span>
        </div>

        <nav className="coach-nav">
          <Link href="/coach">Сегодня</Link>
          <Link href="/coach/groups">Группы</Link>
        </nav>

        <CoachLogoutButton />
      </header>

      <main className="coach-main">{children}</main>
    </div>
  );
}
