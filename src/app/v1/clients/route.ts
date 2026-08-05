import type { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/api/admin";
import { decodeCursor, encodeCursor } from "@/lib/api/cursor";
import { apiError, apiJson, optionsResponse } from "@/lib/api/responses";
import {
  clientsQuerySchema,
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

  const parsed = clientsQuerySchema.safeParse(
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

  const cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : null;
  if (parsed.data.cursor && !cursor) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "The cursor is invalid or has been modified.",
      requestId,
      [{ field: "cursor", message: "Use the cursor returned by the previous response unchanged." }],
      rateLimit,
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("list_api_clients", {
      p_limit: parsed.data.limit + 1,
      p_country: parsed.data.country ?? null,
      p_cursor_created_at: cursor?.created_at ?? null,
      p_cursor_id: cursor?.id ?? null,
    });
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      name: string;
      country: string | null;
      fiscal_year_end: string | null;
      created_at: string;
    }>;
    const hasMore = rows.length > parsed.data.limit;
    const returned = hasMore ? rows.slice(0, parsed.data.limit) : rows;
    const last = returned.at(-1);
    const nextCursor = hasMore && last
      ? encodeCursor({ created_at: last.created_at, id: last.id })
      : null;

    return apiJson(
      {
        data: returned,
        pagination: {
          limit: parsed.data.limit,
          next_cursor: nextCursor,
        },
      },
      200,
      rateLimit,
    );
  } catch (error) {
    console.error({ requestId, location: "list-clients", error });
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
