// Regulatory Knowledge Graph Admin — server-side admin gate.
//
// The page was previously an ungated client component; the gate now runs on
// the server so unpublished regulatory state is never shipped to non-admins.
// When Supabase auth isn't configured (bare local dev), the page stays open.
import Link from "next/link";
import KnowledgeBaseShell from "./shell";
import { isCurrentUserAdmin } from "../../../lib/admin";
import { isAuthConfigured } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KnowledgeBaseAdminPage() {
  const allowed = !isAuthConfigured() || (await isCurrentUserAdmin());
  if (!allowed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e8eef7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Not authorized</h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            The Regulatory Knowledge Graph admin is restricted to administrators. Ask an
            administrator to add your account to <code>ADMIN_EMAILS</code>, or sign in with an
            admin account.
          </p>
          <Link href="/" style={{ color: "#3b82f6", fontSize: 14 }}>← Back to SmartPR</Link>
        </div>
      </div>
    );
  }
  return <KnowledgeBaseShell />;
}
