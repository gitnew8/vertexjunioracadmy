import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReportRow } from "@/lib/types";
import { ExternalLink, Calendar, User, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ReportRow[];
    },
  });
  const [confirming, setConfirming] = useState<string | null>(null);

  async function remove(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Report deleted"); refetch(); }
    setConfirming(null);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Weekly reports shared with parents</p>
        </div>
        <Link to="/teacher/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:opacity-90">
          <Plus className="size-3.5" /> New report
        </Link>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="font-display text-xl">No reports yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first weekly report.</p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {data.map((r) => {
            const url = `${window.location.origin}/report/${r.code}`;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold truncate">{r.student_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="size-3" /> Class {r.student_class} · Roll {r.roll_number}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{new Date(r.week_start).toLocaleDateString()} – {new Date(r.week_end).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/40">{r.subjects.length} subj</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input readOnly value={url} className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground" />
                  <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }} className="rounded-md bg-secondary text-secondary-foreground px-3 py-1.5 text-xs font-medium">Copy</button>
                  <a href={url} target="_blank" className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1">Open <ExternalLink className="size-3" /></a>
                </div>
                <div className="mt-3 text-right">
                  {confirming === r.id ? (
                    <span className="text-xs">Delete? <button onClick={() => remove(r.id)} className="text-destructive font-medium">Yes</button> · <button onClick={() => setConfirming(null)} className="text-muted-foreground">Cancel</button></span>
                  ) : (
                    <button onClick={() => setConfirming(r.id)} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
