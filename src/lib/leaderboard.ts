import { supabase } from "@/integrations/supabase/client";

export type Period = "today" | "week" | "month" | "all";

export type RawAttempt = {
  test_id: string;
  student_id: string;
  score: number;
  total: number;
  submitted_at: string | null;
  time_taken_sec: number;
};

export type StudentLite = {
  id: string;
  name: string;
  student_class: string;
  roll_number: string;
};

export type TestLite = { id: string; subject: string; student_class: string; title: string };

export type LeaderboardEntry = {
  student: StudentLite;
  tests: number;
  avg: number;
  best: number;
  avgTimeSec: number;
  streak: number;
  points: number;
  badge: string;
  rank: number;
};

export type LeaderboardData = {
  students: StudentLite[];
  attempts: RawAttempt[];
  tests: TestLite[];
  hidden: string[];
  enabled: boolean;
  totals: { students: number; attempts: number; gifts: number };
};

export function periodStart(period: Period): number {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.getTime();
  }
  if (period === "week") return now.getTime() - 7 * 864e5;
  if (period === "month") return now.getTime() - 30 * 864e5;
  return 0;
}

function computeStreak(dates: string[]): number {
  const days = Array.from(
    new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10))),
  ).sort((a, b) => (a < b ? 1 : -1));
  if (days.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + "T00:00:00Z").getTime();
    const cur = new Date(days[i] + "T00:00:00Z").getTime();
    if (prev - cur === 864e5) streak++;
    else break;
  }
  return streak;
}

function badgeFor(e: { avg: number; tests: number }): string {
  if (e.avg >= 90 && e.tests >= 5) return "Legend";
  if (e.avg >= 80) return "Champion";
  if (e.avg >= 65) return "Achiever";
  if (e.tests >= 5) return "Consistent";
  return "Rising Star";
}

export async function fetchLeaderboardData(): Promise<LeaderboardData> {
  const [stuRes, attRes, testRes, setRes, claimRes] = await Promise.all([
    supabase.from("students").select("id, name, student_class, roll_number"),
    supabase
      .from("test_attempts")
      .select("test_id, student_id, score, total, submitted_at, time_taken_sec")
      .not("submitted_at", "is", null),
    supabase.from("tests").select("id, subject, student_class, title"),
    supabase.from("app_settings").select("key, value").in("key", ["leaderboard_enabled", "leaderboard_hidden"]),
    supabase.from("reward_claims").select("id, status"),
  ]);

  const settings = new Map((setRes.data || []).map((s) => [s.key, s.value as unknown]));
  const enabled = settings.get("leaderboard_enabled") !== false;
  const hidden = (settings.get("leaderboard_hidden") as string[] | undefined) || [];
  const claims = claimRes.data || [];

  return {
    students: (stuRes.data || []) as StudentLite[],
    attempts: (attRes.data || []) as RawAttempt[],
    tests: (testRes.data || []) as TestLite[],
    hidden,
    enabled,
    totals: {
      students: (stuRes.data || []).length,
      attempts: (attRes.data || []).length,
      gifts: claims.filter((c) => c.status === "approved" || c.status === "delivered").length,
    },
  };
}

export function buildLeaderboard(
  data: LeaderboardData,
  opts: { period: Period; studentClass?: string; subject?: string },
): { entries: LeaderboardEntry[]; stats: { highest: number; accuracy: number } } {
  const cutoff = periodStart(opts.period);
  const testById = new Map(data.tests.map((t) => [t.id, t]));
  const studentById = new Map(data.students.map((s) => [s.id, s]));

  const filtered = data.attempts.filter((a) => {
    if (!a.submitted_at || a.total <= 0) return false;
    if (new Date(a.submitted_at).getTime() < cutoff) return false;
    const s = studentById.get(a.student_id);
    if (!s || data.hidden.includes(a.student_id)) return false;
    if (opts.studentClass && opts.studentClass !== "all" && s.student_class !== opts.studentClass) return false;
    if (opts.subject && opts.subject !== "all") {
      const t = testById.get(a.test_id);
      if (!t || t.subject !== opts.subject) return false;
    }
    return true;
  });

  const byStudent = new Map<string, RawAttempt[]>();
  for (const a of filtered) {
    const arr = byStudent.get(a.student_id) || [];
    arr.push(a);
    byStudent.set(a.student_id, arr);
  }

  let highest = 0;
  let pctSum = 0;
  let pctCount = 0;

  const entries: LeaderboardEntry[] = [];
  for (const [sid, list] of byStudent) {
    const student = studentById.get(sid)!;
    // best attempt per test
    const best = new Map<string, RawAttempt>();
    for (const a of list) {
      const prev = best.get(a.test_id);
      if (!prev || a.score / a.total > prev.score / prev.total) best.set(a.test_id, a);
    }
    const distinct = Array.from(best.values());
    const pcts = distinct.map((a) => (a.score / a.total) * 100);
    const avg = Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length);
    const bestPct = Math.round(Math.max(...pcts));
    const avgTimeSec = Math.round(
      distinct.reduce((s, a) => s + (a.time_taken_sec || 0), 0) / distinct.length,
    );
    highest = Math.max(highest, bestPct);
    pctSum += pcts.reduce((s, p) => s + p, 0);
    pctCount += pcts.length;
    const streak = computeStreak(list.map((a) => a.submitted_at!));
    entries.push({
      student,
      tests: distinct.length,
      avg,
      best: bestPct,
      avgTimeSec,
      streak,
      points: distinct.length * 10 + avg + streak * 5,
      badge: badgeFor({ avg, tests: distinct.length }),
      rank: 0,
    });
  }

  entries.sort(
    (a, b) =>
      b.avg - a.avg ||
      b.tests - a.tests ||
      b.best - a.best ||
      a.avgTimeSec - b.avgTimeSec ||
      a.student.name.localeCompare(b.student.name),
  );
  entries.forEach((e, i) => (e.rank = i + 1));

  return {
    entries,
    stats: {
      highest,
      accuracy: pctCount ? Math.round(pctSum / pctCount) : 0,
    },
  };
}

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}
