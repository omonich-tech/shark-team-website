import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

async function derive(password: string, salt: string) {
  return (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
}

export async function hashCoachPassword(password: string) {
  if (password.length < 8) {
    throw new Error("COACH_PASSWORD_TOO_SHORT");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);

  return {
    salt,
    hash: hash.toString("hex")
  };
}

export async function verifyCoachPassword(
  password: string,
  salt: string,
  expectedHash: string
) {
  const actual = await derive(password, salt);
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
