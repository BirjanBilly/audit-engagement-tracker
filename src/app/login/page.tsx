import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Crebain AI work trial</p>
        <h1 id="login-title">Audit Engagement Tracker</h1>
        <p className="muted">
          Sign in with the reviewer or staff account to manage engagements.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
