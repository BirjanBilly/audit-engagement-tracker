const errorExample = {
  error: {
    code: "VALIDATION_ERROR",
    message: "One or more fields are invalid.",
    details: [{ field: "hours", message: "Hours must be greater than zero." }],
    request_id: "6fdca759-d7f0-49a0-818d-b8272aa655dc",
  },
};

const errorResponse = (description: string, code: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      example: {
        ...errorExample,
        error: { ...errorExample.error, code },
      },
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Audit Engagement Tracker API",
    version: "1.0.0",
    description:
      "Versioned JSON API for audit clients, engagements, time entries, and client summaries.",
  },
  servers: [{ url: "/", description: "Current deployment" }],
  tags: [
    { name: "Clients", description: "Audit client portfolio and summaries" },
    { name: "Engagements", description: "Audit engagement queries" },
    { name: "Time entries", description: "Idempotent time logging" },
  ],
  security: [{ bearerApiKey: [] }],
  paths: {
    "/v1/clients": {
      get: {
        tags: ["Clients"],
        summary: "List clients",
        description:
          "Returns clients in stable created_at/id order using an opaque cursor.",
        operationId: "listClients",
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Page size. Defaults to 25; maximum 100.",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
          {
            name: "cursor",
            in: "query",
            description: "Opaque next_cursor from the previous response.",
            schema: { type: "string" },
          },
          {
            name: "country",
            in: "query",
            description: "Two-letter country code, case-insensitive.",
            schema: { type: "string", pattern: "^[A-Za-z]{2}$" },
          },
        ],
        responses: {
          "200": {
            description: "A page of clients.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "pagination"],
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Client" } },
                    pagination: {
                      type: "object",
                      required: ["limit", "next_cursor"],
                      properties: {
                        limit: { type: "integer", example: 25 },
                        next_cursor: { type: ["string", "null"], example: "eyJ2Ijox...signature" },
                      },
                    },
                  },
                },
                example: {
                  data: [
                    {
                      id: "d639bc6e-0f40-4803-8516-c7c1300563cf",
                      name: "Kestrel Audit",
                      country: "GB",
                      fiscal_year_end: "2026-06-30",
                      created_at: "2026-08-05T10:00:00Z",
                    },
                  ],
                  pagination: { limit: 25, next_cursor: null },
                },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key.", "INVALID_API_KEY"),
          "422": errorResponse("Invalid query parameters.", "VALIDATION_ERROR"),
          "429": errorResponse("Rate limit exceeded.", "RATE_LIMIT_EXCEEDED"),
          "500": errorResponse("Unexpected internal failure.", "INTERNAL_ERROR"),
        },
      },
    },
    "/v1/engagements": {
      get: {
        tags: ["Engagements"],
        summary: "List engagements",
        description: "Filters engagements by status and inclusive created_at range.",
        operationId: "listEngagements",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/EngagementStatus" },
          },
          {
            name: "from",
            in: "query",
            description: "Inclusive ISO-8601 created_at lower bound.",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            description: "Inclusive ISO-8601 created_at upper bound.",
            schema: { type: "string", format: "date-time" },
          },
        ],
        responses: {
          "200": {
            description: "Matching engagements.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Engagement" } },
                  },
                },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key.", "INVALID_API_KEY"),
          "422": errorResponse("Invalid filters.", "VALIDATION_ERROR"),
          "429": errorResponse("Rate limit exceeded.", "RATE_LIMIT_EXCEEDED"),
          "500": errorResponse("Unexpected internal failure.", "INTERNAL_ERROR"),
        },
      },
    },
    "/v1/time-entries": {
      post: {
        tags: ["Time entries"],
        summary: "Create a time entry idempotently",
        description:
          "Requires Idempotency-Key. Replaying the same key and canonical body returns the stored 201 response without another row. Reusing the key with a different body returns 409.",
        operationId: "createTimeEntry",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            description: "Unique key for one logical creation attempt, maximum 200 characters.",
            schema: { type: "string", maxLength: 200 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTimeEntry" },
              example: {
                engagement_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                hours: 3.5,
                entry_date: "2026-08-05",
                description: "Planning meeting and evidence review",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created, or replayed from the stored successful response.",
            headers: {
              "Idempotency-Replayed": {
                description: "true when the response was replayed.",
                schema: { type: "string", enum: ["true", "false"] },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/TimeEntry" } },
                },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key.", "INVALID_API_KEY"),
          "404": errorResponse("Engagement not found.", "RESOURCE_NOT_FOUND"),
          "409": errorResponse("Idempotency key/body conflict.", "IDEMPOTENCY_CONFLICT"),
          "422": errorResponse("Missing key, malformed JSON, or invalid fields.", "VALIDATION_ERROR"),
          "429": errorResponse("Rate limit exceeded.", "RATE_LIMIT_EXCEEDED"),
          "500": errorResponse("Unexpected internal failure.", "INTERNAL_ERROR"),
        },
      },
    },
    "/v1/clients/{id}/summary": {
      get: {
        tags: ["Clients"],
        summary: "Get a client engagement summary",
        description: "Returns total logged hours and counts for every engagement status.",
        operationId: "getClientSummary",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Client summary.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/ClientSummary" } },
                },
                example: {
                  data: {
                    client_id: "d639bc6e-0f40-4803-8516-c7c1300563cf",
                    total_hours: 318.5,
                    engagement_counts: {
                      planning: 2,
                      fieldwork: 3,
                      review: 1,
                      complete: 4,
                    },
                  },
                },
              },
            },
          },
          "401": errorResponse("Missing or invalid API key.", "INVALID_API_KEY"),
          "404": errorResponse("Client not found.", "RESOURCE_NOT_FOUND"),
          "422": errorResponse("Invalid client UUID.", "VALIDATION_ERROR"),
          "429": errorResponse("Rate limit exceeded.", "RATE_LIMIT_EXCEEDED"),
          "500": errorResponse("Unexpected internal failure.", "INTERNAL_ERROR"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API key",
        description: "Reviewer key generated by scripts/create-api-key.ts.",
      },
    },
    schemas: {
      EngagementStatus: {
        type: "string",
        enum: ["planning", "fieldwork", "review", "complete"],
      },
      Client: {
        type: "object",
        required: ["id", "name", "country", "fiscal_year_end", "created_at"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          country: { type: ["string", "null"], pattern: "^[A-Z]{2}$" },
          fiscal_year_end: { type: ["string", "null"], format: "date" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Engagement: {
        type: "object",
        required: ["id", "client_id", "status", "created_at"],
        properties: {
          id: { type: "string", format: "uuid" },
          client_id: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/EngagementStatus" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      CreateTimeEntry: {
        type: "object",
        required: ["engagement_id", "hours", "entry_date"],
        additionalProperties: false,
        properties: {
          engagement_id: { type: "string", format: "uuid" },
          hours: { type: "number", exclusiveMinimum: 0 },
          entry_date: { type: "string", format: "date" },
          description: { type: "string", maxLength: 1000, default: "" },
        },
      },
      TimeEntry: {
        type: "object",
        required: ["id", "engagement_id", "hours", "entry_date", "description", "created_at"],
        properties: {
          id: { type: "string", format: "uuid" },
          engagement_id: { type: "string", format: "uuid" },
          hours: { type: "number" },
          entry_date: { type: "string", format: "date" },
          description: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ClientSummary: {
        type: "object",
        required: ["client_id", "total_hours", "engagement_counts"],
        properties: {
          client_id: { type: "string", format: "uuid" },
          total_hours: { type: "number" },
          engagement_counts: {
            type: "object",
            required: ["planning", "fieldwork", "review", "complete"],
            properties: {
              planning: { type: "integer", minimum: 0 },
              fieldwork: { type: "integer", minimum: 0 },
              review: { type: "integer", minimum: 0 },
              complete: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      ErrorEnvelope: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "details", "request_id"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    field: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
              request_id: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
  },
} as const;
