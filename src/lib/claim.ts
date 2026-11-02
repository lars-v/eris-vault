import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** GM claim codes: shown once, stored only as a SHA-256 hash, expire after 48 hours. */
export const CLAIM_TTL_HOURS = 48;

export function newClaimCode(): string {
  return randomBytes(24).toString("base64url");
}

export function hashClaimCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function hashesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function claimExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + CLAIM_TTL_HOURS * 60 * 60 * 1000);
}

export function isClaimUsable(claim: { expiresAt: Date; usedAt: Date | null }, now = new Date()) {
  return claim.usedAt === null && claim.expiresAt.getTime() > now.getTime();
}
