import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/server/admin/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure:\n      process.env.NODE_ENV === "production" &&\n      process.env.ADMIN_COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
