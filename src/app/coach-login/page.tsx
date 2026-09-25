import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachLoginForm } from "@/components/coach/coach-login-form";
import { getCoachSession } from "@/server/coach/auth";

export const metadata: Metadata = {
  title: "SHARK TEAM — Coach Login",
  robots: {
    index: false,
    follow: false
  }
};

export default async function CoachLoginPage() {
  const session = await getCoachSession();

  if (session) {
    redirect("/coach");
  }

  return (
    <main className="coach-login-page">
      <section className="coach-login-card">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>Coach</h1>
        <p>Кабинет тренера: занятия, посещаемость и пробные.</p>
        <CoachLoginForm />
      </section>
    </main>
  );
}
