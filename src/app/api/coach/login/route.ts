import { NextRequest, NextResponse } from "next/server";
import {
  COACH_SESSION_COOKIE,
  COACH_SESSION_MAX_AGE,
  createCoachSessionToken,
  isCoachAuthConfigured,
  verifyCoachCredentials
} from "@/server/coach/auth";

export async function POST(request: NextRequest) {
  if (!isCoachAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "COACH_AUTH_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  const account = await verifyCoachCredentials(username, password);

  if (!account) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    coach: {
      id: account.coach.id,
      firstName: account.coach.firstName,
      lastName: account.coach.lastName
    }
  });

  response.cookies.set({
    name: COACH_SESSION_COOKIE,
    value: createCoachSessionToken(account.id, account.coachId),
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COACH_COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: COACH_SESSION_MAX_AGE
  });

  return response;
}
