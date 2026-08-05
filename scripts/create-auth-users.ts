import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const users = [
  {
    label: "reviewer",
    email: process.env.REVIEWER_EMAIL,
    password: process.env.REVIEWER_PASSWORD,
  },
  {
    label: "second user",
    email: process.env.SECOND_USER_EMAIL,
    password: process.env.SECOND_USER_PASSWORD,
  },
];

for (const user of users) {
  if (!user.email || !user.password) {
    throw new Error(`Missing credentials for ${user.label}.`);
  }
  if (user.password.length < 12) {
    throw new Error(`${user.label} password must be at least 12 characters.`);
  }
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const found = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error("User search exceeded 2,000 users; narrow the script.");
}

for (const user of users) {
  const existing = await findUserByEmail(user.email!);
  if (existing) {
    console.log(`${user.label}: already exists (${existing.id})`);
    continue;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email!,
    password: user.password!,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`${user.label}: created (${data.user.id})`);
}

console.log("Both accounts are present. Keep passwords outside Git.");
