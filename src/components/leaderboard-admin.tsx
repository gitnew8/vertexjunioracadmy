import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, RotateCcw, FileDown, Trophy } from "lucide-react";
import { getSetting, setSetting } from "@/lib/rewards";
import { buildLeaderboard, fetchLeaderboardData, type LeaderboardData } from "@/lib/leaderboard";

export function LeaderboardAdmin() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [hidden, setHidden] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const load = () =>
    fetchLeaderboardData().then((d) => {
      setData(d);
      setEnabled(d.enabled);
      setHidden(d.hidden);
    });

  useEffect(() => {
    load();
  }, []);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await setSetting("leaderboard_enabled", next);
    toast.success(next ? "Leaderboard enabled" : "Leaderboard disabled");
  }

  async function toggleHidden(id: string) {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    await setSetting("leaderboard_hidden", next);
  }

  async function resetMonthly() {
    await setSetting("leaderboard_reset_at", new Date().toISOString());
    const prev = await getSetting<string>("leaderboard_reset_at");
    toast.success(`Monthly rankings reset marked at ${new Date(prev || Date.now()).toLocaleString()}`);
  }

  function exportCsv() {
    if (!data) return;
    const { entries } = buildLeaderboard(data, { period: "month" });
    const head = ["Rank", "Name", "Class", "Roll", "Tests", "AvgScore", "BestScore", "Streak", "Points", "Badge"];
    const rows = entries.map((e) => [
      e.rank,
      e.student.name,
      e.student.student_class,
      e.student.roll_number,
      e.tests,
      e.avg,
      e.best,
      e.streak,
      e.points,
      e.badge,
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const needle = q.trim().toLowerCase();
  const students = (data?.students || []).filter(
    (s) => !needle || s.name.toLowerCase().includes(needle) || s.roll_number.toLowerCase().includes(needle),
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" /> Top Performers Leaderboard
        </h3>
        <div className="flex gap-2">
          <button
            onClick={toggleEnabled}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${enabled ? "bg-emerald-500 text-white" : "bg-secondary"}`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </button>
          <button onClick={exportCsv} className="rounded-lg border border-border px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
            <FileDown className="size-3.5" /> Export
          </button>
          <button onClick={resetMonthly} className="rounded-lg border border-border px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
            <RotateCcw className="size-3.5" /> Reset monthly
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search student to hide/show…"
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <ul className="mt-2 max-h-56 overflow-y-auto divide-y divide-border">
        {students.slice(0, 50).map((s) => {
          const isHidden = hidden.includes(s.id);
          return (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className={isHidden ? "text-muted-foreground line-through" : ""}>
                {s.name} · Class {s.student_class} · Roll {s.roll_number}
              </span>
              <button
                onClick={() => toggleHidden(s.id)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {isHidden ? "Hidden" : "Visible"}
              </button>
            </li>
          );
        })}
        {students.length === 0 && <li className="py-3 text-xs text-muted-foreground">No students found.</li>}
      </ul>
    </div>
  );
}
