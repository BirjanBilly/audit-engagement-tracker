import Link from "next/link";
import { DocsViewer } from "@/components/docs-viewer";

export const metadata = { title: "API Documentation" };

export default function DocsPage() {
  return (
    <main style={{ background: "white", minHeight: "100vh" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #ddd" }}>
        <Link href="/">← Return to tracker</Link>
        <span style={{ marginLeft: 16 }}>
          Raw specification: <a href="/openapi.json">/openapi.json</a>
        </span>
      </div>
      <DocsViewer />
    </main>
  );
}
