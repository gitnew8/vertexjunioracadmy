import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Clock, GraduationCap, CheckCircle2, XCircle, Send, FileText, Shield, Camera } from "lucide-react";
import { TermsModal } from "@/components/terms-modal";
import { checkAndAwardRewards } from "@/lib/rewards";
import {
  DEFAULT_SETTINGS,
  fetchExamSecuritySettings,
  useExamSecurity,
  seededShuffle,
  computeRisk,
  policyToStatus,
  logSecurityEvent,
  type ExamSecuritySettings,
} from "@/lib/exam-security";


const SESSION_KEY = "student_session_v2";

type Session = { name: string; student_class: string; roll_number: string; login_number: string };

type Test = {
  id: string;
  title: string;
  student_class: string;
  subject: string;
  chapter: string | null;
  time_limit_min: number;
  total_marks: number;
  status: string;
  is_free: boolean | null;
  price: number | null;
  discount_price: number | null;
};

type Question = {
  id: string;
  q_no: number;
  section: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
};

type QEval = { verdict: "Correct" | "Partial" | "Wrong"; marks: number; feedback: string };

type Attempt = {
  id: string;
  score: number;
  total: number;
  time_taken_sec: number;
  submitted_at: string | null;
  answers: Record<string, string>;
  evaluations?: Record<string, QEval>;
};

export const Route = createFileRoute("/student/test/$id")({
  component: TakeTestPage,
});

function TakeTestPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [existing, setExisting] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [security, setSecurity] = useState<ExamSecuritySettings>(DEFAULT_SETTINGS);
  const [seed, setSeed] = useState<string>("");
  const submittedRef = useRef(false);
  const secCtx = useMemo(
    () => ({ test_id: id, student_id: studentId, attempt_id: null as string | null }),
    [id, studentId],
  );

  const { warnings, tabSwitches, cameraOn, videoRef } = useExamSecurity({
    active: started && !existing && security.system_enabled,
    settings: security,
    ctx: secCtx,
    onAutoSubmit: (reason) => {
      toast.error(`Auto-submitting: ${reason}`);
      submit();
    },
  });

  // Shuffle questions & options with per-attempt seed (once test loaded + started)
  const shuffled = useMemo(() => {
    if (!questions.length) return { list: questions, optMap: {} as Record<string, number[]> };
    const s = seed || `${id}-${studentId || "anon"}`;
    const list = security.randomize_questions ? seededShuffle(questions, s + ":q") : questions;
    const optMap: Record<string, number[]> = {};
    for (const q of list) {
      if (q.section === "MCQ" && q.options && security.randomize_options) {
        const idxs = q.options.map((_, i) => i);
        optMap[q.id] = seededShuffle(idxs, s + ":" + q.id);
      } else if (q.options) {
        optMap[q.id] = q.options.map((_, i) => i);
      }
    }
    return { list, optMap };
  }, [questions, seed, id, studentId, security.randomize_questions, security.randomize_options]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      navigate({ to: "/student" });
      return;
    }
    setSession(JSON.parse(raw) as Session);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: stu } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      if (!stu) {
        toast.error("Student not found");
        navigate({ to: "/student" });
        return;
      }
      setStudentId(stu.id);

      const { data: t, error: tErr } = await supabase
        .from("tests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (tErr || !t) {
        toast.error("Test not found");
        navigate({ to: "/student" });
        return;
      }
      if (t.status !== "published" || t.student_class !== session.student_class) {
        toast.error("This test is not available for you");
        navigate({ to: "/student" });
        return;
      }
      setTest(t as Test);
      setSecondsLeft((t as Test).time_limit_min * 60);

      const [{ data: qs }, { data: at }, sec] = await Promise.all([
        supabase.from("test_questions").select("*").eq("test_id", id).order("q_no"),
        supabase
          .from("test_attempts")
          .select("*")
          .eq("test_id", id)
          .eq("student_id", stu.id)
          .maybeSingle(),
        fetchExamSecuritySettings(),
      ]);
      if (cancelled) return;
      setQuestions((qs || []) as Question[]);
      if (at) setExisting(at as unknown as Attempt);
      setSecurity(sec);
      setLoading(false);

    })();
    return () => {
      cancelled = true;
    };
  }, [session, id, navigate]);

  // Timer
  useEffect(() => {
    if (existing || !started || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, existing, started]);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (!test || !studentId) return;
    setSubmitting(true);

    let score = 0;
    let total = 0;
    const evaluations: Record<string, QEval> = {};
    const subjective: Question[] = [];

    for (const q of questions) {
      total += q.marks;
      const a = (answers[q.id] || "").trim();
      if (q.section === "MCQ" || q.section === "TrueFalse") {
        const ok = a && a.toLowerCase() === q.correct_answer.trim().toLowerCase();
        const marks = ok ? q.marks : 0;
        if (ok) score += q.marks;
        evaluations[q.id] = {
          verdict: ok ? "Correct" : a ? "Wrong" : "Wrong",
          marks,
          feedback: ok
            ? "Correct answer. Well done!"
            : `Correct answer: ${q.correct_answer}.`,
        };
      } else {
        subjective.push(q);
      }
    }

    // AI examiner for subjective answers (Short / Long / anything else)
    if (subjective.length) {
      try {
        const res = await fetch("/api/public/ai-evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: test.subject,
            student_class: test.student_class,
            items: subjective.map((q) => ({
              q_no: q.q_no,
              question: q.question,
              section: q.section,
              marks: q.marks,
              student_answer: answers[q.id] || "",
            })),
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            evaluations: { q_no: number; verdict: QEval["verdict"]; marks: number; feedback: string }[];
          };
          const byNo = new Map(json.evaluations.map((e) => [e.q_no, e]));
          for (const q of subjective) {
            const e = byNo.get(q.q_no);
            if (e) {
              const m = Math.max(0, Math.min(q.marks, Number(e.marks) || 0));
              score += m;
              evaluations[q.id] = { verdict: e.verdict, marks: m, feedback: e.feedback };
            } else {
              evaluations[q.id] = {
                verdict: "Wrong",
                marks: 0,
                feedback: "Could not evaluate automatically.",
              };
            }
          }
        } else {
          toast.error("AI examiner busy — saved without AI grading for written answers.");
          for (const q of subjective) {
            evaluations[q.id] = {
              verdict: "Wrong",
              marks: 0,
              feedback: "Pending teacher review.",
            };
          }
        }
      } catch {
        for (const q of subjective) {
          evaluations[q.id] = {
            verdict: "Wrong",
            marks: 0,
            feedback: "Pending teacher review.",
          };
        }
      }
    }

    const time_taken_sec = Math.floor((Date.now() - startedAt) / 1000);

    // Compute risk from events
    let risk_score = 0;
    let risk_label: "low" | "medium" | "high" = "low";
    let result_status = "auto_released";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: events } = await sb
        .from("exam_security_events")
        .select("event_type, severity")
        .eq("student_id", studentId)
        .eq("test_id", test.id)
        .gte("created_at", new Date(startedAt).toISOString());
      const r = computeRisk((events || []) as { event_type: string; severity: string }[]);
      risk_score = r.score;
      risk_label = r.label;
      const policy =
        risk_label === "high"
          ? security.result_policy_high
          : risk_label === "medium"
            ? security.result_policy_medium
            : security.result_policy_low;
      result_status = policyToStatus(policy);
    } catch {
      /* ignore risk errors */
    }

    const { data, error } = await supabase
      .from("test_attempts")
      .insert({
        test_id: test.id,
        student_id: studentId,
        score,
        total,
        time_taken_sec,
        answers,
        evaluations,
        submitted_at: new Date().toISOString(),
        warnings_count: warnings,
        risk_score,
        risk_label,
        result_status,
        security_summary: { tab_switches: tabSwitches, warnings },
      })
      .select("*")
      .single();

    setSubmitting(false);
    if (error) {
      submittedRef.current = false;
      return toast.error(error.message);
    }
    setExisting(data as unknown as Attempt);

    // Reward auto-check
    checkAndAwardRewards(studentId).then((res) => {
      if (res.awarded.length > 0) {
        toast.success(
          `🎁 Congratulations! You unlocked: ${res.awarded.map((r) => r.title).join(", ")}`,
        );
      }
    });
  }

  if (loading || !session || !test) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (existing) {
    return <ResultView test={test} questions={questions} attempt={existing} />;
  }

  if (!started) {
    const hasDiscount =
      !test.is_free &&
      test.discount_price != null &&
      Number(test.discount_price) < Number(test.price || 0);
    const displayPrice = test.is_free
      ? "FREE"
      : hasDiscount
        ? `₹${test.discount_price}`
        : Number(test.price || 0) > 0
          ? `₹${test.price}`
          : "FREE";
    return (
      <div className="min-h-screen">
        <Toaster richColors position="top-center" />
        <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
        <main className="mx-auto max-w-lg px-5 py-10">
          <Link
            to="/student"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <GraduationCap className="size-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold mt-3">{test.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {test.subject}
              {test.chapter ? ` · ${test.chapter}` : ""}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Time</div>
                <div className="font-semibold">{test.time_limit_min}m</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Marks</div>
                <div className="font-semibold">{test.total_marks}</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Questions</div>
                <div className="font-semibold">{questions.length}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Test fee</div>
                <div className="font-display text-2xl font-semibold text-primary">
                  {displayPrice}
                  {hasDiscount && (
                    <span className="ml-2 text-sm text-muted-foreground line-through font-normal">
                      ₹{test.price}
                    </span>
                  )}
                </div>
              </div>
              {test.is_free && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                  FREE TEST
                </span>
              )}
            </div>

            <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1"
              />
              <span>
                Main{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <FileText className="size-3.5" /> Terms &amp; Conditions
                </button>{" "}
                padh liye hain aur agree karta hoon.
              </span>
            </label>

            {security.system_enabled && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <Shield className="size-3.5" /> Exam security active
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  {security.fullscreen_required && <li>Fullscreen mandatory</li>}
                  {security.tab_switch_limit > 0 && (
                    <li>Tab change → warning ({security.warning_limit} max)</li>
                  )}
                  {security.camera_required && <li>Camera monitoring on</li>}
                  {security.block_copy_paste && <li>Copy/paste blocked</li>}
                </ul>
              </div>
            )}

            <button
              disabled={!acceptedTerms}
              onClick={() => {
                setStarted(true);
                setStartedAt(Date.now());
                setSeed(`${id}-${studentId || "anon"}-${Date.now()}`);
                logSecurityEvent(
                  { attempt_id: null, student_id: studentId, test_id: id },
                  "warning",
                  { reason: "test_started" },
                  "low",
                );
              }}
              className="mt-5 w-full rounded-lg bg-primary text-primary-foreground py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Start test
            </button>

          </div>
        </main>
      </div>
    );
  }

  const mm = Math.floor((secondsLeft ?? 0) / 60);
  const ss = (secondsLeft ?? 0) % 60;
  const low = (secondsLeft ?? 0) < 60;

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold truncate">{test.title}</div>
              <div className="text-xs text-muted-foreground">
                {test.subject} · {test.total_marks} marks
              </div>
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold ${
              low ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            <Clock className="size-4" />
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6 space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground mb-1">
              Q{q.q_no} · {q.section} · {q.marks} mark{q.marks > 1 ? "s" : ""}
            </div>
            <div className="font-medium">{q.question}</div>
            <div className="mt-3">
              {q.section === "MCQ" && q.options ? (
                <div className="space-y-2">
                  {q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const checked = answers[q.id] === letter;
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                          checked ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={checked}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: letter }))}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : q.section === "TrueFalse" ? (
                <div className="flex gap-2">
                  {["True", "False"].map((v) => {
                    const checked = answers[q.id] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                          checked ? "border-primary bg-primary/10 text-primary font-medium" : "border-border"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  rows={q.section === "Short" ? 3 : 1}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              )}
            </div>
          </div>
        ))}

        <button
          onClick={() => {
            if (confirm("Submit your test? You can't change answers after this.")) submit();
          }}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-3 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Send className="size-4" /> {submitting ? "Submitting…" : "Submit test"}
        </button>
      </main>
    </div>
  );
}

function ResultView({ test, questions, attempt }: { test: Test; questions: Question[]; attempt: Attempt }) {
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const mm = Math.floor(attempt.time_taken_sec / 60);
  const ss = attempt.time_taken_sec % 60;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between">
          <Link to="/student" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to my tests
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-2xl font-semibold">{test.title}</h1>
        <p className="text-sm text-muted-foreground">Test submitted</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Score" value={`${attempt.score}/${attempt.total}`} />
          <Stat label="Percentage" value={`${pct}%`} accent={pct >= 60 ? "ok" : pct >= 35 ? "warn" : "bad"} />
          <Stat label="Time taken" value={`${mm}m ${ss}s`} />
        </div>

        <h2 className="font-display text-lg font-semibold mt-8 mb-3">Answers & teacher feedback</h2>
        <div className="space-y-3">
          {questions.map((q) => {
            const a = attempt.answers?.[q.id] || "";
            const ev = attempt.evaluations?.[q.id];
            const verdict = ev?.verdict ?? (a.trim().toLowerCase() === q.correct_answer.trim().toLowerCase() ? "Correct" : "Wrong");
            const awarded = ev?.marks ?? (verdict === "Correct" ? q.marks : 0);
            const tone =
              verdict === "Correct"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : verdict === "Partial"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-red-500/30 bg-red-500/5";
            const Icon = verdict === "Wrong" ? XCircle : CheckCircle2;
            const iconCls =
              verdict === "Correct"
                ? "text-emerald-600 dark:text-emerald-400"
                : verdict === "Partial"
                ? "text-amber-600 dark:text-amber-400"
                : "text-destructive";
            return (
              <div key={q.id} className={`rounded-xl border p-4 ${tone}`}>
                <div className="flex items-start gap-2">
                  <Icon className={`size-5 shrink-0 mt-0.5 ${iconCls}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        Q{q.q_no} · {q.section} · {awarded}/{q.marks} mark{q.marks > 1 ? "s" : ""}
                      </div>
                      <span className={`text-xs font-semibold ${iconCls}`}>{verdict}</span>
                    </div>
                    <div className="font-medium">{q.question}</div>
                    <div className="mt-2 text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className="font-medium whitespace-pre-wrap">{a || "— not answered —"}</span>
                      </div>
                      {ev?.feedback && (
                        <div className="mt-2 rounded-lg bg-background/60 border border-border p-2.5 text-sm">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Teacher feedback</div>
                          {ev.feedback}
                        </div>
                      )}
                      {!ev && verdict === "Wrong" && (q.section === "MCQ" || q.section === "TrueFalse") && (
                        <div>
                          <span className="text-muted-foreground">Correct answer: </span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {q.correct_answer}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "ok" | "warn" | "bad" }) {
  const cls =
    accent === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : accent === "bad"
      ? "text-destructive"
      : "";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold font-display ${cls}`}>{value}</div>
    </div>
  );
}
