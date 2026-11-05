import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramMiniAppIdentity = { id: bigint; firstName: string };

export function verifyMiniAppInitData(raw: string): TelegramMiniAppIdentity | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !raw || raw.length > 8192) return null;

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash) || !Number.isInteger(authDate)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 15 * 60) return null;

  // Reject ambiguous repeated keys: the Telegram signature covers a single value per key.
  const keys = new Set<string>();
  for (const [key] of params) {
    if (keys.has(key)) return null;
    keys.add(key);
  }
  const checkString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = createHmac("sha256", secret).update(checkString).digest();
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== calculated.length || !timingSafeEqual(expected, calculated)) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "{}") as { id?: number; first_name?: string };
    if (!Number.isSafeInteger(user.id) || !user.id || user.id <= 0) return null;
    return { id: BigInt(user.id), firstName: user.first_name?.slice(0, 80) ?? "" };
  } catch {
    return null;
  }
}
