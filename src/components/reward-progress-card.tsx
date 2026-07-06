import { useEffect, useState } from "react";
import { Gift, Trophy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchActiveRules,
  getSetting,
  computeProgress,
  type RewardRule,
  type StudentAttemptLite,
} from "@/lib/rewards";

export function RewardProgressCard({
  studentId,
  onOpenTerms,
}: {
  studentId: string | null;
  onOpenTerms?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [attempts, setAttempts] = useState<StudentAttemptLite[]>([]);
  const [claims, setClaims] = useState<
    { rule_id: string; status: string; earned_at: string }[]
  >([]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [en, rs, atRes, clRes] = await Promise.all([
        getSetting<boolean>("reward_system_enabled"),
        fetchActiveRules(),
        supabase
          .from("test_attempts")
          .select("test_id, score, total, submitted_at")
          .eq("student_id", studentId)
          .not("submitted_at", "is", null),
        supabase
          .from("reward_claims")
          .select("rule_id, status, earned_at")
          .eq("student_id", studentId),
      ]);
      if (cancelled) return;
      setEnabled(en !== false);
      setRules(rs);
      setAttempts((atRes.data || []) as StudentAttemptLite[]);
      setClaims((clRes.data || []) as { rule_id: string; status: string; earned_at: string }[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId || !enabled) return null;
  if (loading) return null;
  if (rules.length === 0) return null;

  const claimByRule = new Map(claims.map((c) => [c.rule_id, c]));

  return (
    <section className="mt-8 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-pink-500/5 to-transparent p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" /> More Test, More Gift
        </h2>
        {onOpenTerms && (
          <button
            onClick={onOpenTerms}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <Sparkles className="size-3" /> Terms &amp; Conditions
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Zyada test do, zyada score karo, aur asli gifts jeeto!
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rules.map((r) => {
          const p = computeProgress(attempts, r);
          const testsPct = Math.min(100, Math.round((p.tests / r.min_tests) * 100));
          const claim = claimByRule.get(r.id);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-xl bg-gradient-to-br from-amber-400 to-pink-500 text-white grid place-items-center text-xl shrink-0">
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{r.title}</div>
                    {claim && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                          claim.status === "delivered"
                            ? "bg-emerald-500 text-white"
                            : claim.status === "approved"
                              ? "bg-blue-500 text-white"
                              : claim.status === "rejected"
                                ? "bg-red-500 text-white"
                                : "bg-amber-500 text-white"
                        }`}
                      >
                        {claim.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {r.min_tests} tests · avg ≥ {r.min_score_percent}% · {r.cycle_days}d
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        {p.tests}/{r.min_tests} tests
                      </span>
                      <span
                        className={
                          p.avg >= r.min_score_percent
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        avg {p.avg}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-pink-500 transition-all"
                        style={{ width: `${testsPct}%` }}
                      />
                    </div>
                  </div>
                  {p.qualified && !claim && (
                    <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                      <Gift className="size-3.5" /> Unlocked! Waiting for approval.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
