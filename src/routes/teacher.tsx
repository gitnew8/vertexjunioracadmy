import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AdminShell } from "@/components/admin-shell";

const ADMIN_PASSWORD = "Admincreat2026";
const ADMIN_SESSION_KEY = "admin_ok_v1";

export const Route = createFileRoute("/teacher")({
  component: TeacherLayout,
  head: () => ({ meta: [{ title: "Admin — Vertex Junior Academy" }] }),
});

function TeacherLayout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && authed && loc.pathname === "/teacher") {
      navigate({ to: "/teacher/dashboard", replace: true });
    }
  }, [hydrated, authed, loc.pathname, navigate]);

  if (!hydrated) {
    return <main className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</main>;
  }

  if (!authed) {
    return (
      <>
        <Toaster richColors position="top-center" />
        <AdminGate
          onSuccess={() => {
            sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
            setAuthed(true);
          }}
        />
      </>
    );
  }

  return (
    <AdminShell>
      <Toaster richColors position="top-center" />
      <Outlet />
    </AdminShell>
  );
}

function AdminGate({ onSuccess }: { onSuccess: () => void }) {
  const [pwd, setPwd] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) onSuccess();
    else toast.error("Incorrect admin password");
  }
  return (
    <main className="min-h-screen grid place-items-center px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]"
      >
        <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Lock className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold mt-4">Admin access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vertex Junior Academy admin panel.
        </p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Admin password"
          autoFocus
          className="mt-5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button className="mt-4 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90">
          Continue
        </button>
      </form>
    </main>
  );
}
