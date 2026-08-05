import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.REVIEWER_EMAIL;
const password = process.env.REVIEWER_PASSWORD;

if (!url || !anonKey || !email || !password) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, REVIEWER_EMAIL, and REVIEWER_PASSWORD are required.",
  );
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonRead = await anon.from("clients").select("id,name").limit(1);
if (anonRead.error) {
  throw new Error(`Anonymous client SELECT failed: ${anonRead.error.message}`);
}
console.log("PASS: anon can SELECT clients.");

const anonInsert = await anon
  .from("clients")
  .insert({ name: `Unauthorized ${randomUUID()}` })
  .select("id");
if (!anonInsert.error) {
  throw new Error("FAIL: anonymous client INSERT unexpectedly succeeded.");
}
console.log("PASS: anon cannot INSERT clients.");

const anonEngagementRead = await anon.from("engagements").select("id").limit(1);
if (!anonEngagementRead.error) {
  throw new Error("FAIL: anonymous engagement SELECT unexpectedly succeeded.");
}
console.log("PASS: anon cannot SELECT engagements.");

const authenticated = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const signIn = await authenticated.auth.signInWithPassword({ email, password });
if (signIn.error) throw signIn.error;

const testName = `RLS Test ${randomUUID()}`;
const created = await authenticated
  .from("clients")
  .insert({ name: testName, country: "GB" })
  .select("id")
  .single();
if (created.error) {
  throw new Error(`Authenticated INSERT failed: ${created.error.message}`);
}
console.log("PASS: authenticated user can INSERT clients.");

const updated = await authenticated
  .from("clients")
  .update({ fiscal_year_end: "2026-12-31" })
  .eq("id", created.data.id)
  .select("id")
  .single();
if (updated.error) {
  throw new Error(`Authenticated UPDATE failed: ${updated.error.message}`);
}
console.log("PASS: authenticated user can UPDATE clients.");

const removed = await authenticated
  .from("clients")
  .delete()
  .eq("id", created.data.id);
if (removed.error) {
  throw new Error(`Authenticated DELETE failed: ${removed.error.message}`);
}
console.log("PASS: authenticated user can DELETE clients.");

await authenticated.auth.signOut();
console.log("RLS verification completed successfully.");
