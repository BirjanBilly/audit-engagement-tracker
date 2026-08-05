import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z.object({
  v: z.literal(1),
  created_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.string().uuid(),
});

export type ClientCursor = z.infer<typeof payloadSchema>;

function secret(): string {
  const value = process.env.CURSOR_SECRET;
  if (!value || value.length < 32) {
    throw new Error("CURSOR_SECRET must contain at least 32 characters.");
  }
  return value;
}

function signature(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

export function encodeCursor(cursor: Omit<ClientCursor, "v">): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, ...cursor }),
    "utf8",
  ).toString("base64url");
  const sig = signature(payload).toString("base64url");
  return `${payload}.${sig}`;
}

export function decodeCursor(value: string): ClientCursor | null {
  try {
    const [payload, suppliedSignature, extra] = value.split(".");
    if (!payload || !suppliedSignature || extra) return null;
    const expected = signature(payload);
    const supplied = Buffer.from(suppliedSignature, "base64url");
    if (expected.length !== supplied.length) return null;
    if (!timingSafeEqual(expected, supplied)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const parsed = payloadSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
