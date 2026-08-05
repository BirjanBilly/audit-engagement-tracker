import Link from "next/link";
import { signOut } from "@/app/login/actions";

export function Header({ email }: { email: string }) {
  return (
    <header className="site-header">
      <div>
        <Link className="brand" href="/">
          Audit Engagement Tracker
        </Link>
        <p className="header-subtitle">Crebain AI technical work trial</p>
      </div>
      <div className="account-area">
        <span>{email}</span>
        <form action={signOut}>
          <button className="text-button" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
