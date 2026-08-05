import type { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/api/admin";
import { sha256, stableStringify } from "@/lib/api/hash";
import { apiError, apiJson, optionsResponse } from "@/lib/api/responses";
import { timeEntrySchema, zodDetails } from "@/lib/api/validation";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;
  const { requestId, apiKeyId, rateLimit } = auth.context;

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return apiError(
      422,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key is required for time-entry creation.",
      requestId,
      [{ field: "Idempotency-Key", message: "Supply a unique key for this logical operation." }],
      rateLimit,
    );
  }
  if (idempotencyKey.length > 200) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "The idempotency key is too long.",
      requestId,
      [{ field: "Idempotency-Key", message: "Use 200 characters or fewer." }],
      rateLimit,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "The request body must be valid JSON.",
      requestId,
      [{ field: "body", message: "Send Content-Type: application/json and valid JSON." }],
      rateLimit,
    );
  }

  const parsed = timeEntrySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "One or more fields are invalid.",
      requestId,
      zodDetails(parsed.error),
      rateLimit,
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_time_entry_idempotent", {
      p_api_key_id: apiKeyId,
      p_idempotency_key_hash: sha256(idempotencyKey),
      p_request_hash: sha256(stableStringify(parsed.data)),
      p_engagement_id: parsed.data.engagement_id,
      p_hours: parsed.data.hours,
      p_entry_date: parsed.data.entry_date,
      p_description: parsed.data.description,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;

    if (result.outcome === "conflict") {
      return apiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This Idempotency-Key was already used with a different request body.",
        requestId,
        [{ field: "Idempotency-Key", message: "Use the original body or a new key." }],
        rateLimit,
      );
    }
    if (result.outcome === "not_found") {
      return apiError(
        404,
        "RESOURCE_NOT_FOUND",
        "The specified engagement does not exist.",
        requestId,
        [{ field: "engagement_id", message: "No engagement was found for this UUID." }],
        rateLimit,
      );
    }

    return apiJson(
      result.response_body,
      Number(result.response_status),
      rateLimit,
      { "Idempotency-Replayed": result.replayed ? "true" : "false" },
    );
  } catch (error) {
    console.error({ requestId, location: "create-time-entry", error });
    return apiError(
      500,
      "INTERNAL_ERROR",
      "The request could not be completed.",
      requestId,
      [],
      rateLimit,
    );
  }
}
