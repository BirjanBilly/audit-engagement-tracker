"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isReadOnly } from "@/lib/env";
import type { FormState } from "@/lib/forms";

const engagementSchema = z.object({
  client_id: z.string().uuid("Client ID is invalid."),
  status: z.enum(["planning", "fieldwork", "review", "complete"]),
});

const timeEntrySchema = z.object({
  client_id: z.string().uuid("Client ID is invalid."),
  engagement_id: z.string().uuid("Engagement ID is invalid."),
  hours: z.coerce.number().positive("Hours must be greater than zero."),
  entry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  description: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
});

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return { supabase, userId: null };
  }
  return { supabase, userId: String(data.claims.sub) };
}

export async function createEngagement(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (isReadOnly()) {
    return {
      ok: false,
      message: "The tracker is temporarily read-only while data is migrated.",
    };
  }

  const parsed = engagementSchema.safeParse({
    client_id: formData.get("client_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the engagement details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, userId } = await requireUser();
  if (!userId) {
    return { ok: false, message: "Your session expired. Sign in again." };
  }

  const { error } = await supabase.from("engagements").insert({
    client_id: parsed.data.client_id,
    status: parsed.data.status,
  });
  if (error) {
    console.error("createEngagement", error.code);
    return {
      ok: false,
      message: "We couldn’t create the engagement. Please try again.",
    };
  }

  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true, message: "Engagement created." };
}

export async function createTimeEntry(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (isReadOnly()) {
    return {
      ok: false,
      message: "The tracker is temporarily read-only while data is migrated.",
    };
  }

  const parsed = timeEntrySchema.safeParse({
    client_id: formData.get("client_id"),
    engagement_id: formData.get("engagement_id"),
    hours: formData.get("hours"),
    entry_date: formData.get("entry_date"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the time-entry details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, userId } = await requireUser();
  if (!userId) {
    return { ok: false, message: "Your session expired. Sign in again." };
  }

  const { error } = await supabase.from("time_entries").insert({
    engagement_id: parsed.data.engagement_id,
    hours: parsed.data.hours,
    entry_date: parsed.data.entry_date,
    description: parsed.data.description,
  });
  if (error) {
    console.error("createTimeEntry", error.code);
    return {
      ok: false,
      message: "We couldn’t save the time entry. Please try again.",
    };
  }

  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true, message: "Time entry saved." };
}
