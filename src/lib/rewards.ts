import { supabase } from "@/integrations/supabase/client";

export type RewardRule = {
  id: string;
  title: string;
  description: string | null;
  min_tests: number;
  min_score_percent: number;
  cycle_days: number;
  stock: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
};

export type RewardClaim = {
  id: string;
  student_id: string;
  rule_id: string;
  status: "pending" | "approved" | "rejected" | "delivered";
  tests_count: number;
  avg_score: number;
  notes: string | null;
  earned_at: string;
  approved_at: string | null;
};

export type StudentAttemptLite = {
  test_id: string;
  score: number;
  total: number;
  submitted_at: string | null;
};

export async function fetchActiveRules(): Promise<RewardRule[]> {
  const { data } = await supabase
    .from("reward_rules")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data || []) as RewardRule[];
}

export async function fetchAllRules(): Promise<RewardRule[]> {
  const { data } = await supabase
    .from("reward_rules")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data || []) as RewardRule[];
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? null) as T | null;
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

/** Given attempts + rules, compute per-rule progress for a student */
export function computeProgress(
  attempts: StudentAttemptLite[],
  rule: RewardRule,
) {
  const cutoff = Date.now() - rule.cycle_days * 24 * 60 * 60 * 1000;
  const inWindow = attempts.filter(
    (a) => a.submitted_at && new Date(a.submitted_at).getTime() >= cutoff && a.total > 0,
  );
  // dedupe by test_id (best score per test)
  const bestByTest = new Map<string, StudentAttemptLite>();
  for (const a of inWindow) {
    const prev = bestByTest.get(a.test_id);
    const pct = (a.score / a.total) * 100;
    const prevPct = prev ? (prev.score / prev.total) * 100 : -1;
    if (pct > prevPct) bestByTest.set(a.test_id, a);
  }
  const distinct = Array.from(bestByTest.values());
  const tests = distinct.length;
  const avg =
    distinct.length > 0
      ? Math.round(
          distinct.reduce((s, a) => s + (a.score / a.total) * 100, 0) / distinct.length,
        )
      : 0;
  const qualified = tests >= rule.min_tests && avg >= rule.min_score_percent;
  return { tests, avg, qualified };
}

/** After submit or on dashboard: check rules and auto-award pending claims */
export async function checkAndAwardRewards(studentId: string) {
  const enabled = await getSetting<boolean>("reward_system_enabled");
  if (enabled === false) return { awarded: [] as RewardRule[] };

  const [rules, attemptsRes, claimsRes] = await Promise.all([
    fetchActiveRules(),
    supabase
      .from("test_attempts")
      .select("test_id, score, total, submitted_at")
      .eq("student_id", studentId)
      .not("submitted_at", "is", null),
    supabase.from("reward_claims").select("rule_id").eq("student_id", studentId),
  ]);
  const attempts = (attemptsRes.data || []) as StudentAttemptLite[];
  const alreadyClaimed = new Set((claimsRes.data || []).map((c) => c.rule_id));

  const awarded: RewardRule[] = [];
  for (const r of rules) {
    if (alreadyClaimed.has(r.id)) continue;
    const p = computeProgress(attempts, r);
    if (p.qualified) {
      const { error } = await supabase.from("reward_claims").insert({
        student_id: studentId,
        rule_id: r.id,
        status: "pending",
        tests_count: p.tests,
        avg_score: p.avg,
      });
      if (!error) awarded.push(r);
    }
  }
  return { awarded };
}
