import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { verifyCoachPassword } from "@/server/coach/password";

export const COACH_SESSION_COOKIE = "shark_coach_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

type CoachSessionPayload = {
  accountId: string;
  coachId: string;
  exp: number;
};

function getSecret() {
  return process.env.COACH_SESSION_SECRET ?? null;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isCoachAuthConfigured() {
  return Boolean(getSecret());
}

export async function verifyCoachCredentials(
  username: string,
  password: string
) {
  if (!getSecret()) {
    return null;
  }

  const prisma = getPrisma();

  const account = await prisma.coachAccount.findUnique({
    where: { username },
    include: {
      coach: true
    }
  });

  if (!account || !account.isActive || account.coach.status !== "ACTIVE") {
    return null;
  }

  const valid = await verifyCoachPassword(
    password,
    account.passwordSalt,
    account.passwordHash
  );

  if (!valid) {
    return null;
  }

  return account;
}

export function createCoachSessionToken(
  accountId: string,
  coachId: string
) {
  const secret = getSecret();

  if (!secret) {
    throw new Error("COACH_AUTH_NOT_CONFIGURED");
  }

  const payload: CoachSessionPayload = {
    accountId,
    coachId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyCoachSessionToken(token: string | undefined) {
  const secret = getSecret();

  if (!secret || !token) {
    return null;
  }

  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded, secret);

  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as CoachSessionPayload;

    if (
      !payload.accountId ||
      !payload.coachId ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getCoachSession() {
  const cookieStore = await cookies();
  const payload = verifyCoachSessionToken(
    cookieStore.get(COACH_SESSION_COOKIE)?.value
  );

  if (!payload) {
    return null;
  }

  const prisma = getPrisma();

  const account = await prisma.coachAccount.findFirst({
    where: {
      id: payload.accountId,
      coachId: payload.coachId,
      isActive: true,
      coach: {
        status: "ACTIVE"
      }
    },
    include: {
      coach: true
    }
  });

  if (!account) {
    return null;
  }

  return {
    accountId: account.id,
    coachId: account.coachId,
    username: account.username,
    coach: account.coach
  };
}

export async function requireCoachSession() {
  const session = await getCoachSession();

  if (!session) {
    redirect("/coach-login");
  }

  return session;
}

export const COACH_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
