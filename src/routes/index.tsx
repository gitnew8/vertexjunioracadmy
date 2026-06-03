import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, FileText, Share2, ShieldCheck } from "lucide-react";
import vertexLogo from "@/assets/vertex-logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Weekly Student Report — Share progress as PDF" },
      {
        name: "description",
        content:
          "Teachers create weekly subject-wise reports. Parents view & download as PDF via a private link. No login required.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold">WeeklyReport</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/student"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary transition"
            >
              Student login
            </Link>
            <Link
              to="/teacher"
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <img
              src={vertexLogo.url}
              alt="Vertex Junior Academy logo"
              className="size-32 md:size-40 mb-6 drop-shadow-md"
            />
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/40 text-accent-foreground px-3 py-1 text-xs font-medium">
              <ShieldCheck className="size-3.5" />
              No login. No sign-up. Just share.
            </span>
            <h1 className="mt-4 font-display text-5xl md:text-6xl font-bold leading-[1.05] text-center md:text-left">
              Vertex Junior Academy
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Teachers write subject-wise weekly reports. Parents open a private link to view
              and download the PDF — instantly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/student"
                className="rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium shadow-[var(--shadow-soft)] hover:opacity-90 transition"
              >
                Student login
              </Link>
              <Link
                to="/teacher"
                className="rounded-xl border border-border bg-card px-6 py-3 font-medium hover:bg-secondary transition"
              >
                Admin login
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl bg-card border border-border shadow-[var(--shadow-paper)] p-6 rotate-1">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <div className="font-display text-xl font-semibold">Sunrise Academy</div>
                  <div className="text-xs text-muted-foreground">Weekly Progress Report</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  Mar 04 – Mar 10
                </div>
              </div>
              <div className="mt-3 text-sm grid grid-cols-3 gap-2">
                <div><div className="text-muted-foreground text-xs">Student</div>Aarav Sharma</div>
                <div><div className="text-muted-foreground text-xs">Class</div>VIII-B</div>
                <div><div className="text-muted-foreground text-xs">Roll</div>14</div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["Mathematics", "Good", "Quadratic equations"],
                  ["Science", "Average", "Electricity basics"],
                  ["English", "Good", "Essay writing"],
                ].map(([s, p, t]) => (
                  <div key={s} className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                    <div>
                      <div className="font-medium">{s}</div>
                      <div className="text-xs text-muted-foreground">{t}</div>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: p === "Good" ? "color-mix(in oklab, var(--success) 18%, transparent)" : "color-mix(in oklab, var(--warning) 25%, transparent)",
                        color: "var(--foreground)",
                      }}
                    >{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: "1. Teacher writes", body: "Fill the weekly form — subjects, topics, performance, homework, remarks." },
            { icon: Share2, title: "2. Share the link", body: "Each report gets a unique read-only link. Send it to the parent." },
            { icon: ShieldCheck, title: "3. View & download", body: "Parents view the report and download a clean PDF — no account needed." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="size-6 text-primary" />
              <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Built for teachers. Loved by parents.
      </footer>
    </div>
  );
}
