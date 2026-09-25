import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_SESSION_COOKIE = "shark_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

type AdminPayload = {
  sub: string;
  exp: number;
};

function config() {
  return {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    secret: process.env.ADMIN_SESSION_SECRET
  };
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

export function isAdminConfigured() {
  const values = config();
  return Boolean(values.username && values.password && values.secret);
}

export function verifyAdminCredentials(username: string, password: string) {
  const values = config();

  if (!values.username || !values.password || !values.secret) {
    return false;
  }

  return (
    safeEqual(username, values.username) &&
    safeEqual(password, values.password)
  );
}

export function createAdminSessionToken() {
  const values = config();

  if (!values.username || !values.secret) {
    throw new Error("ADMIN_AUTH_NOT_CONFIGURED");
  }

  const payload: AdminPayload = {
    sub: values.username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, values.secret)}`;
}

export function verifyAdminSessionToken(token: string | undefined) {
  const values = config();

  if (!token || !values.username || !values.secret) {
    return null;
  }

  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded, values.secret);

  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as AdminPayload;

    if (
      payload.sub !== values.username ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin-login");
  }

  return session;
}

export const ADMIN_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
