import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LeaderboardFull } from "@/components/leaderboard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({
    meta: [
      { title: "Top Performers Leaderboard — Vertex Junior Academy" },
      {
        name: "description",
        content:
          "Live student leaderboard: top 10 performers by average score, tests completed, streaks and reward points.",
      },
      { property: "og:title", content: "🏆 Top Performers Leaderboard" },
      {
        property: "og:description",
        content: "See who is leading this month. Complete more tests, score higher, reach the Top 10!",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-sm text-destructive">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center text-sm">Leaderboard not found.</div>,
});

const SESSION_KEY = "student_session_v2";

function LeaderboardPage() {
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as { login_number?: string };
      if (!s.login_number) return;
      supabase
        .from("students")
        .select("id")
        .eq("login_number", s.login_number)
        .maybeSingle()
        .then(({ data }) => setStudentId(data?.id ?? null));
    } catch {
      /* ignore malformed session */
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/student"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <LeaderboardFull studentId={studentId} />
      </div>
    </main>
  );
}
