import type { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/api/admin";
import { apiError, apiJson, optionsResponse } from "@/lib/api/responses";
import { uuidSchema } from "@/lib/api/validation";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;
  const { requestId, rateLimit } = auth.context;
  const { id } = await params;

  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "The client ID is invalid.",
      requestId,
      [{ field: "id", message: "Use a valid UUID." }],
      rateLimit,
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_client_summary", {
      p_client_id: parsed.data,
    });
    if (error) throw error;
    if (!data) {
      return apiError(
        404,
        "RESOURCE_NOT_FOUND",
        "The specified client does not exist.",
        requestId,
        [],
        rateLimit,
      );
    }
    return apiJson({ data }, 200, rateLimit);
  } catch (error) {
    console.error({ requestId, location: "client-summary", error });
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
