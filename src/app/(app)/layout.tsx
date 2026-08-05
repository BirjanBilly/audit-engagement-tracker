import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { isReadOnly } from "@/lib/env";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  return (
    <div className="app-shell">
      <Header email={data.user.email ?? "Signed-in user"} />
      {isReadOnly() ? (
        <div className="maintenance-banner" role="status">
          Migration in progress: the tracker is temporarily read-only.
        </div>
      ) : null}
      <main className="page-shell">{children}</main>
    </div>
  );
}
