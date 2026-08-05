import type { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/api/admin";
import { apiError, apiJson, optionsResponse } from "@/lib/api/responses";
import {
  engagementsQuerySchema,
  searchParamsToObject,
  zodDetails,
} from "@/lib/api/validation";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;
  const { requestId, rateLimit } = auth.context;

  const parsed = engagementsQuerySchema.safeParse(
    searchParamsToObject(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "One or more query parameters are invalid.",
      requestId,
      zodDetails(parsed.error),
      rateLimit,
    );
  }

  try {
    const admin = createAdminClient();
    let query = admin
      .from("engagements")
      .select("id,client_id,status,created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (parsed.data.status) query = query.eq("status", parsed.data.status);
    if (parsed.data.from) query = query.gte("created_at", parsed.data.from);
    if (parsed.data.to) query = query.lte("created_at", parsed.data.to);

    const { data, error } = await query;
    if (error) throw error;
    return apiJson({ data: data ?? [] }, 200, rateLimit);
  } catch (error) {
    console.error({ requestId, location: "list-engagements", error });
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
