import { NextResponse } from "next/server";
import { COACH_SESSION_COOKIE } from "@/server/coach/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: COACH_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COACH_COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
