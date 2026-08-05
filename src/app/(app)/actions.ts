"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isReadOnly } from "@/lib/env";
import type { FormState } from "@/lib/forms";

const statusSchema = z.enum(["planning", "fieldwork", "review", "complete"]);
const engagementSchema = z.object({
  client_id: z.string().uuid("Client ID is invalid."),
  status: statusSchema,
});
const timeEntrySchema = z.object({
  client_id: z.string().uuid("Client ID is invalid."),
  engagement_id: z.string().uuid("Engagement ID is invalid."),
  hours: z.coerce.number().positive("Hours must be greater than zero."),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  description: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

function readonlyMessage(): FormState {
  return {
    ok: false,
    message: "The tracker is temporarily read-only while data is migrated.",
  };
}

export async function completeOnboarding(): Promise<void> {
  const { supabase, user } = await authenticatedClient();
  if (!user) return;
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("completeOnboarding", error.code);
  revalidatePath("/");
}

export async function createEngagement(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (isReadOnly()) return readonlyMessage();
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

  const { supabase, user } = await authenticatedClient();
  if (!user) return { ok: false, message: "Your session expired. Sign in again." };

  const { error } = await supabase.from("engagements").insert(parsed.data);
  if (error) {
    console.error("createEngagement", error.code);
    return { ok: false, message: "We couldn’t create the engagement. Please try again." };
  }
  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true, message: "Engagement created." };
}

export async function createTimeEntry(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (isReadOnly()) return readonlyMessage();
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

  const { supabase, user } = await authenticatedClient();
  if (!user) return { ok: false, message: "Your session expired. Sign in again." };
  const { error } = await supabase.from("time_entries").insert({
    engagement_id: parsed.data.engagement_id,
    hours: parsed.data.hours,
    entry_date: parsed.data.entry_date,
    description: parsed.data.description,
  });
  if (error) {
    console.error("createTimeEntry", error.code);
    return { ok: false, message: "We couldn’t save the time entry. Please try again." };
  }
  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true, message: "Time entry saved." };
}

export async function updateEngagementStatus(input: {
  engagementId: string;
  clientId: string;
  status: string;
}): Promise<{ ok: boolean; message: string }> {
  if (isReadOnly()) return { ok: false, message: readonlyMessage().message };
  const parsed = z
    .object({
      engagementId: z.string().uuid(),
      clientId: z.string().uuid(),
      status: statusSchema,
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "The selected status is invalid." };
  }

  const { supabase, user } = await authenticatedClient();
  if (!user) return { ok: false, message: "Your session expired. Sign in again." };
  const { error } = await supabase
    .from("engagements")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.engagementId);
  if (error) {
    console.error("updateEngagementStatus", error.code);
    return {
      ok: false,
      message: "We couldn’t save the new status. Your previous status has been restored.",
    };
  }
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, message: `Status updated to ${parsed.data.status}.` };
}
