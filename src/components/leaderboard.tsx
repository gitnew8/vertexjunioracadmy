import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Trophy, Search, Flame, Gift, X, Timer, Target } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  buildLeaderboard,
  fetchLeaderboardData,
  fmtTime,
  initials,
  type LeaderboardData,
  type LeaderboardEntry,
  type Period,
} from "@/lib/leaderboard";
import { computeProgress, fetchActiveRules, type RewardRule } from "@/lib/rewards";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

function useLeaderboardData() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => fetchLeaderboardData().then((d) => !cancelled && setData(d));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  return data;
}

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {shown}
      {suffix}
    </>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 8) * 0.15,
        hue: (i * 47) % 360,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 size-1.5 rounded-sm opacity-80"
          style={{
            left: `${p.left}%`,
            background: `hsl(${p.hue} 90% 60%)`,
            animation: `lb-fall 2.6s ${p.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Avatar({ name, size = "size-11" }: { name: string; size?: string }) {
  return (
    <div
      className={`${size} shrink-0 rounded-full grid place-items-center font-semibold text-white bg-gradient-to-br from-primary via-fuchsia-500 to-amber-500`}
    >
      {initials(name)}
    </div>
  );
}

function medalStyle(rank: number) {
  if (rank === 1)
    return "border-amber-400/60 bg-gradient-to-br from-amber-300/25 via-amber-200/10 to-transparent";
  if (rank === 2)
    return "border-slate-300/60 bg-gradient-to-br from-slate-300/25 via-slate-200/10 to-transparent";
  if (rank === 3)
    return "border-orange-400/60 bg-gradient-to-br from-orange-400/25 via-orange-300/10 to-transparent";
  return "border-border bg-card/70";
}

function rankIcon(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function EntryCard({
  e,
  onClick,
  compact,
}: {
  e: LeaderboardEntry;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animation: "lb-rise .45s ease-out both", animationDelay: `${Math.min(e.rank, 10) * 40}ms` }}
      className={`relative w-full text-left rounded-2xl border p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${medalStyle(e.rank)}`}
    >
      {e.rank === 1 && <Confetti />}
      <div className="relative flex items-center gap-3">
        <div className="w-9 text-center text-lg font-bold">{rankIcon(e.rank)}</div>
        <div className="relative">
          <Avatar name={e.student.name} />
          {e.rank === 1 && (
            <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 size-5 text-amber-400 drop-shadow animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{e.student.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            Class {e.student.student_class} · Roll {e.student.roll_number} ·{" "}
            <span className="text-primary font-medium">{e.badge}</span>
          </div>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>📝 {e.tests} tests</span>
              <span>🎯 best {e.best}%</span>
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3 text-orange-500" /> {e.streak}d
              </span>
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3" /> {fmtTime(e.avgTimeSec)}
              </span>
              <span>⭐ {e.points} pts</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-xl font-bold">
            <Counter value={e.avg} suffix="%" />
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">avg score</div>
        </div>
      </div>
    </button>
  );
}

function ProfileModal({
  entry,
  data,
  onClose,
}: {
  entry: LeaderboardEntry;
  data: LeaderboardData;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<RewardRule[]>([]);
  useEffect(() => {
    fetchActiveRules().then(setRules);
  }, []);

  const testById = new Map(data.tests.map((t) => [t.id, t]));
  const history = data.attempts
    .filter((a) => a.student_id === entry.student.id && a.submitted_at && a.total > 0)
    .sort((a, b) => (a.submitted_at! < b.submitted_at! ? -1 : 1));
  const chart = history.map((a, i) => ({
    n: i + 1,
    pct: Math.round((a.score / a.total) * 100),
    title: testById.get(a.test_id)?.title || "Test",
  }));
  const attempts = history.map((a) => ({
    test_id: a.test_id,
    score: a.score,
    total: a.total,
    submitted_at: a.submitted_at,
  }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl animate-scale-in"
      >
        <div className="flex items-start gap-3">
          <Avatar name={entry.student.name} size="size-14" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-semibold truncate">{entry.student.name}</div>
            <div className="text-xs text-muted-foreground">
              Class {entry.student.student_class} · Roll {entry.student.roll_number}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Trophy className="size-3.5" /> Rank #{entry.rank} · {entry.badge}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            ["Accuracy", `${entry.avg}%`],
            ["Tests", `${entry.tests}`],
            ["Best", `${entry.best}%`],
            ["Points", `${entry.points}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-secondary/40 p-2">
              <div className="font-display text-lg font-bold">{v}</div>
              <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
            </div>
          ))}
        </div>

        {chart.length > 1 && (
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="n" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <h4 className="mt-4 font-semibold text-sm flex items-center gap-1.5">
          <Gift className="size-4 text-amber-500" /> Gift progress
        </h4>
        <div className="mt-2 space-y-2">
          {rules.length === 0 && <p className="text-xs text-muted-foreground">No active rewards.</p>}
          {rules.map((r) => {
            const p = computeProgress(attempts, r);
            return (
              <div key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>{r.title}</span>
                  <span className={p.qualified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                    {p.qualified ? "Unlocked" : `${Math.max(0, r.min_tests - p.tests)} tests left`}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Target {r.min_tests} tests · avg ≥ {r.min_score_percent}% · you: {p.tests} tests, {p.avg}%
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-pink-500"
                    style={{ width: `${Math.min(100, Math.round((p.tests / r.min_tests) * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <h4 className="mt-4 font-semibold text-sm">Recent tests</h4>
        <ul className="mt-2 space-y-1">
          {chart
            .slice(-6)
            .reverse()
            .map((c, i) => (
              <li key={i} className="flex justify-between text-xs rounded-lg bg-secondary/40 px-3 py-2">
                <span className="truncate mr-2">{c.title}</span>
                <span className="font-semibold">{c.pct}%</span>
              </li>
            ))}
          {chart.length === 0 && <li className="text-xs text-muted-foreground">No tests yet.</li>}
        </ul>
      </div>
    </div>
  );
}

export function LeaderboardWidget({ studentId }: { studentId?: string | null }) {
  const data = useLeaderboardData();
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  if (!data || !data.enabled) return null;
  const { entries } = buildLeaderboard(data, { period: "month" });
  if (entries.length === 0) return null;
  const mine = studentId ? entries.find((e) => e.student.id === studentId) : undefined;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-transparent p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            🏆 Top Performers
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            See who is leading this month. Complete more tests, score higher, and reach the Top 10!
          </p>
        </div>
        <Link
          to="/leaderboard"
          className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:opacity-90"
        >
          View Full Leaderboard
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {entries.slice(0, 3).map((e) => (
          <EntryCard key={e.student.id} e={e} compact onClick={() => setSelected(e)} />
        ))}
      </div>

      {mine && mine.rank > 3 && (
        <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-xs">
          My current rank: <span className="font-bold">#{mine.rank}</span> of {entries.length} · avg{" "}
          {mine.avg}%
        </div>
      )}

      {selected && <ProfileModal entry={selected} data={data} onClose={() => setSelected(null)} />}
    </section>
  );
}

export function LeaderboardFull({ studentId }: { studentId?: string | null }) {
  const data = useLeaderboardData();
  const [period, setPeriod] = useState<Period>("month");
  const [cls, setCls] = useState("all");
  const [subject, setSubject] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);

  if (!data) return <div className="text-sm text-muted-foreground">Loading leaderboard…</div>;
  if (!data.enabled)
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        The leaderboard is currently turned off by your teacher.
      </div>
    );

  const { entries, stats } = buildLeaderboard(data, { period, studentClass: cls, subject });
  const classes = Array.from(new Set(data.students.map((s) => s.student_class))).sort();
  const subjects = Array.from(new Set(data.tests.map((t) => t.subject))).sort();
  const needle = q.trim().toLowerCase();
  const searched = needle
    ? entries.filter(
        (e) =>
          e.student.name.toLowerCase().includes(needle) ||
          e.student.roll_number.toLowerCase().includes(needle),
      )
    : entries.slice(0, 10);
  const mine = studentId ? entries.find((e) => e.student.id === studentId) : undefined;
  const tenth = entries[9];

  return (
    <div>
      <header className="text-center">
        <h1 className="font-display text-3xl md:text-4xl font-bold">🏆 Top Performers</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
          See who is leading this month. Complete more tests, score higher, and reach the Top 10!
        </p>
      </header>

      <div className="mt-5 flex flex-wrap justify-center gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              period === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        <select
          value={cls}
          onChange={(e) => setCls(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or roll no."
            className="rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs w-56"
          />
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        {searched.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">No results for this filter yet.</p>
        )}
        {searched.map((e) => (
          <EntryCard key={e.student.id} e={e} onClick={() => setSelected(e)} />
        ))}
      </div>

      {mine && (
        <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-5 backdrop-blur-xl">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="size-4 text-primary" /> My Current Rank
          </h3>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-card p-3">
              <div className="font-display text-xl font-bold">#{mine.rank}</div>
              <div className="text-[10px] uppercase text-muted-foreground">position</div>
            </div>
            <div className="rounded-xl bg-card p-3">
              <div className="font-display text-xl font-bold">{entries.length}</div>
              <div className="text-[10px] uppercase text-muted-foreground">ranked students</div>
            </div>
            <div className="rounded-xl bg-card p-3">
              <div className="font-display text-xl font-bold">{mine.points}</div>
              <div className="text-[10px] uppercase text-muted-foreground">reward points</div>
            </div>
            <div className="rounded-xl bg-card p-3">
              <div className="font-display text-xl font-bold">
                {mine.rank <= 10 || !tenth ? "—" : Math.max(1, tenth.points - mine.points + 1)}
              </div>
              <div className="text-[10px] uppercase text-muted-foreground">points to top 10</div>
            </div>
          </div>
          {mine.rank > 10 && tenth && (
            <p className="mt-2 text-xs text-muted-foreground">
              Next reward target: reach {tenth.avg}% average with {tenth.tests}+ tests to enter the Top 10.
            </p>
          )}
        </div>
      )}

      <footer className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
        {[
          ["Registered students", data.totals.students],
          ["Tests conducted", data.totals.attempts],
          ["Highest score", stats.highest],
          ["Platform accuracy", stats.accuracy],
          ["Gifts distributed", data.totals.gifts],
        ].map(([label, value], i) => (
          <div key={label as string} className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur-xl">
            <div className="font-display text-xl font-bold">
              <Counter value={value as number} suffix={i >= 2 && i <= 3 ? "%" : ""} />
            </div>
            <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
          </div>
        ))}
      </footer>

      {selected && <ProfileModal entry={selected} data={data} onClose={() => setSelected(null)} />}
    </div>
  );
}
