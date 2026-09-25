import { timingSafeEqual } from "node:crypto";

export function isPaymeAuthorized(header: string | null) {
  const login = process.env.PAYME_LOGIN;
  const key = process.env.PAYME_KEY;

  if (!login || !key || !header) {
    return false;
  }

  const expected = `Basic ${Buffer.from(`${login}:${key}`).toString(
    "base64"
  )}`;

  const receivedBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
