import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Clock, User, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/teacher/live")({
  component: LivePage,
});

type LiveAttempt = {
  id: string;
  student_id: string;
  test_id: string;
  started_at: string;
  time_taken_sec: number;
  test: { title: string; subject: string; student_class: string } | null;
};

function LivePage() {
  const [live, setLive] = useState<LiveAttempt[]>([]);
  const [now, setNow] = useState(Date.now());

  async function fetchLive() {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("test_attempts")
      .select("id, student_id, test_id, started_at, time_taken_sec, tests(title, subject, student_class)")
      .is("submitted_at", null)
      .gte("started_at", fifteenMinAgo)
      .order("started_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const normalized = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      test_id: row.test_id,
      started_at: row.started_at,
      time_taken_sec: row.time_taken_sec,
      test: row.tests,
    }));
    setLive(normalized);
  }

  useEffect(() => {
    fetchLive();
    const interval = setInterval(() => {
      fetchLive();
      setNow(Date.now());
    }, 10000);

    const channel = supabase
      .channel("live-students")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "test_attempts" },
        () => fetchLive()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Activity className="size-6 text-emerald-500" /> Live Now
          </h1>
          <p className="text-sm text-muted-foreground">
            Students currently taking tests (refreshes every 10s)
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-medium">{live.length} online</span>
        </div>
      </div>

      {live.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Activity className="size-10 mx-auto text-muted-foreground" />
          <p className="font-display text-xl mt-4">No one is online right now</p>
          <p className="text-sm text-muted-foreground mt-1">
            Students appear here when they start a test.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {live.map((attempt) => (
            <div
              key={attempt.id}
              className="rounded-2xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <User className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Student</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                      {attempt.student_id.slice(0, 8)}…
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <span className="truncate">
                  {attempt.test?.title || "Unknown test"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{attempt.test?.subject || ""} · {attempt.test?.student_class || ""}</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDistanceToNow(new Date(attempt.started_at), { addSuffix: true })}
                </span>
              </div>

              <Link
                to="/teacher/tests/$id"
                params={{ id: attempt.test_id }}
                search={{ tab: "results" }}
                className="block w-full text-center rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 text-xs font-medium transition-colors"
              >
                View test results
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
