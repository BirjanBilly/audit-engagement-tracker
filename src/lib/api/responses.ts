import { NextResponse } from "next/server";

export type ErrorDetail = {
  field?: string;
  message: string;
};

export type RateLimitState = {
  limit: number;
  remaining: number;
  resetEpoch: number;
};

function commonHeaders(rateLimit?: RateLimitState) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers":
      "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Idempotency-Replayed",
  });
  if (rateLimit) {
    headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    headers.set("X-RateLimit-Reset", String(rateLimit.resetEpoch));
  }
  return headers;
}

export function apiJson(
  body: unknown,
  status: number,
  rateLimit?: RateLimitState,
  extraHeaders?: HeadersInit,
) {
  const headers = commonHeaders(rateLimit);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return NextResponse.json(body, { status, headers });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details: ErrorDetail[] = [],
  rateLimit?: RateLimitState,
) {
  return apiJson(
    {
      error: {
        code,
        message,
        details,
        request_id: requestId,
      },
    },
    status,
    rateLimit,
  );
}

export function optionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
