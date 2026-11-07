import { randomBytes, randomInt } from "crypto";

export function createTestPassword(): string {
  const classes = [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "!#$%&*+?",
  ];
  return (
    randomBytes(18).toString("base64url") +
    classes.map((alphabet) => alphabet[randomInt(alphabet.length)]).join("")
  );
}

export function createWeakTestPassword(): string {
  return randomBytes(3).toString("hex");
}

export function createOversizedTestPassword(): string {
  return createTestPassword() + String.fromCodePoint(233).repeat(35);
}

export function createTestSecret(): string {
  return randomBytes(48).toString("hex");
}
