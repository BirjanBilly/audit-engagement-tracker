import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "./admin";
import { apiError, type RateLimitState } from "./responses";

export type ApiContext = {
  requestId: string;
  apiKeyId: string;
  rateLimit: RateLimitState;
};

export async function authenticateApiRequest(
  request: NextRequest,
): Promise<{ context: ApiContext; response?: never } | { response: Response; context?: never }> {
  const requestId = randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    return {
      response: apiError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Provide an API key using Authorization: Bearer <api-key>.",
        requestId,
      ),
    };
  }

  const rawKey = match[1].trim();
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const admin = createAdminClient();
  const { data: key, error } = await admin
    .from("api_keys")
    .select("id,active")
    .eq("key_hash", keyHash)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error({ requestId, location: "api-key-lookup", code: error.code });
    return {
      response: apiError(
        500,
        "INTERNAL_ERROR",
        "The request could not be completed.",
        requestId,
      ),
    };
  }
  if (!key) {
    return {
      response: apiError(
        401,
        "INVALID_API_KEY",
        "The supplied API key is invalid or inactive.",
        requestId,
      ),
    };
  }

  const { data: rateRows, error: rateError } = await admin.rpc(
    "consume_api_rate_limit",
    { p_api_key_id: key.id, p_limit: 60 },
  );
  if (rateError) {
    console.error({ requestId, location: "rate-limit", code: rateError.code });
    return {
      response: apiError(
        500,
        "INTERNAL_ERROR",
        "The request could not be completed.",
        requestId,
      ),
    };
  }

  const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  const rateLimit: RateLimitState = {
    limit: 60,
    remaining: Number(rate.remaining),
    resetEpoch: Number(rate.reset_epoch),
  };

  if (!rate.allowed) {
    return {
      response: apiError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "This API key has exceeded 60 requests in the current minute.",
        requestId,
        [],
        rateLimit,
      ),
    };
  }

  const lastUsed = await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);
  if (lastUsed.error) {
    console.warn({ requestId, location: "last-used-update", code: lastUsed.error.code });
  }

  return {
    context: { requestId, apiKeyId: key.id, rateLimit },
  };
}
