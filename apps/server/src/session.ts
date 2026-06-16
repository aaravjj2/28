import { randomBytes } from "node:crypto";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePlayerId(): string {
  return randomBytes(16).toString("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateRoomCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i];
    if (byte === undefined) {
      throw new Error("Failed to generate room code");
    }
    code += ROOM_CODE_CHARS[byte % ROOM_CODE_CHARS.length];
  }
  return code;
}

export function sessionTokensMatch(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}
