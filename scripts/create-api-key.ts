import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const name = process.env.API_KEY_NAME ?? "Crebain reviewer";
if (!url || !serviceRole) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Retire earlier active keys with the same label so rerunning the script does
// not leave an unknown collection of reviewer credentials.
const retired = await admin
  .from("api_keys")
  .update({ active: false })
  .eq("name", name)
  .eq("active", true);
if (retired.error) throw retired.error;

const rawKey = `creb_live_${randomBytes(32).toString("base64url")}`;
const keyHash = createHash("sha256").update(rawKey).digest("hex");
const keyPrefix = rawKey.slice(0, 18);

const created = await admin.from("api_keys").insert({
  name,
  key_hash: keyHash,
  key_prefix: keyPrefix,
});
if (created.error) throw created.error;

console.log("API key created. Copy it now; only its SHA-256 hash is stored.");
console.log(rawKey);
console.log("Do not paste this key into Git, README.md, DEBUG_LOG.md, or screenshots.");
