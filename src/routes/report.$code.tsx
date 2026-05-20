import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReportRow, Performance } from "@/lib/types";
import { generateReportPdf } from "@/lib/pdf";
import { Download, Eye, GraduationCap, Calendar, User, Hash } from "lucide-react";

export const Route = createFileRoute("/report/$code")({
  component: ReportView,
  head: () => ({
    meta: [
      { title: "Weekly Progress Report" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function perfClass(p: Performance) {
  if (p === "Good") return "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-foreground";
  if (p === "Average") return "bg-[color-mix(in_oklab,var(--warning)_25%,transparent)] text-foreground";
  return "bg-[color-mix(in_oklab,var(--danger)_18%,transparent)] text-foreground";
}

function ReportView() {
  const { code } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ReportRow | null;
    },
  });

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading report…</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center px-5">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl font-semibold">Report not found</h1>
          <p className="text-muted-foreground mt-2">
            This link may be incorrect or the report no longer exists.
          </p>
          <Link to="/" className="mt-4 inline-block text-primary underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const r = data;
  const expired = r.expires_at && new Date(r.expires_at) < new Date();
  if (expired) {
    return (
      <div className="min-h-screen grid place-items-center px-5 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold">Link expired</h1>
          <p className="text-muted-foreground mt-2">Please ask the teacher for a fresh link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-display font-semibold truncate">WeeklyReport</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateReportPdf(r, "open")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <Eye className="size-4" /> <span className="hidden sm:inline">View PDF</span>
            </button>
            <button
              onClick={() => generateReportPdf(r, "download")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              <Download className="size-4" /> Download
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <article className="rounded-2xl bg-card border border-border shadow-[var(--shadow-paper)] overflow-hidden">
          <header className="p-6 md:p-8 border-b border-border flex items-start gap-4">
            {r.logo_url ? (
              <img src={r.logo_url} alt="" className="h-16 w-16 object-contain rounded-lg border border-border bg-white p-1.5 shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
                <GraduationCap className="size-8" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl md:text-3xl font-semibold leading-tight">
                {r.coaching_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Weekly Progress Report</p>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(r.week_start).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                {" – "}
                {new Date(r.week_end).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
          </header>

          <section className="p-6 md:p-8 grid grid-cols-3 gap-4 border-b border-border">
            <Stat icon={<User className="size-3.5" />} label="Student" value={r.student_name} />
            <Stat icon={<GraduationCap className="size-3.5" />} label="Class" value={r.student_class} />
            <Stat icon={<Hash className="size-3.5" />} label="Roll No." value={r.roll_number} />
          </section>

          <section className="p-6 md:p-8 space-y-4">
            <h2 className="font-display text-lg font-semibold">Subjects</h2>
            {r.subjects.map((s, i) => (
              <div key={i} className="rounded-xl border border-border p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold text-lg">{s.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${perfClass(s.performance)}`}>
                      {s.performance}
                    </span>
                  </div>
                </div>
                {s.topics && (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Topics covered
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{s.topics}</p>
                  </div>
                )}
                {s.remarks && (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Teacher remarks
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{s.remarks}</p>
                  </div>
                )}
              </div>
            ))}
          </section>

          <footer className="px-6 md:px-8 py-5 border-t border-border bg-secondary/40 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>{r.teacher_name ? `Teacher: ${r.teacher_name}` : "This is a system-generated report"}</span>
            <span>Generated {new Date(r.created_at).toLocaleDateString()}</span>
          </footer>
        </article>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Read-only report · No edits possible from this link
        </p>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium inline-flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="mt-1 font-semibold text-base md:text-lg break-words">{value}</div>
    </div>
  );
}
