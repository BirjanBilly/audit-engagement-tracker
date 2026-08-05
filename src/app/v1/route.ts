import type { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { apiJson, optionsResponse } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;
  return apiJson(
    {
      data: {
        name: "Audit Engagement Tracker API",
        version: "v1",
        documentation: "/docs",
        endpoints: [
          "GET /v1/clients",
          "GET /v1/engagements",
          "POST /v1/time-entries",
          "GET /v1/clients/{id}/summary",
        ],
      },
    },
    200,
    auth.context.rateLimit,
  );
}
