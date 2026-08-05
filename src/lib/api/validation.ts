import { z } from "zod";
import type { ErrorDetail } from "./responses";

const dateTime = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Use an ISO-8601 date-time.",
);

export const clientsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value), "Use a two-letter country code.")
    .optional(),
});

export const engagementsQuerySchema = z
  .object({
    status: z.enum(["planning", "fieldwork", "review", "complete"]).optional(),
    from: dateTime.optional(),
    to: dateTime.optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && Date.parse(value.from) > Date.parse(value.to)) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "from must be earlier than or equal to to.",
      });
    }
  });

export const timeEntrySchema = z.object({
  engagement_id: z.string().uuid("Use a valid engagement UUID."),
  hours: z.number().positive("Hours must be greater than zero.").max(999999.99),
  entry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, "Use a real calendar date."),
  description: z.string().trim().max(1000).default(""),
});

export const uuidSchema = z.string().uuid();

export function zodDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || undefined,
    message: issue.message,
  }));
}

export function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}
