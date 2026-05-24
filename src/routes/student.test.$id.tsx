import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Clock, GraduationCap, CheckCircle2, XCircle, Send } from "lucide-react";

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
  const [startedAt] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const submittedRef = useRef(false);

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

      const [{ data: qs }, { data: at }] = await Promise.all([
        supabase.from("test_questions").select("*").eq("test_id", id).order("q_no"),
        supabase
          .from("test_attempts")
          .select("*")
          .eq("test_id", id)
          .eq("student_id", stu.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setQuestions((qs || []) as Question[]);
      if (at) setExisting(at as Attempt);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, id, navigate]);

  // Timer
  useEffect(() => {
    if (existing || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, existing]);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (!test || !studentId) return;
    setSubmitting(true);

    let score = 0;
    let total = 0;
    for (const q of questions) {
      total += q.marks;
      const a = answers[q.id];
      if (a && a.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
        score += q.marks;
      }
    }
    const time_taken_sec = Math.floor((Date.now() - startedAt) / 1000);

    const { data, error } = await supabase
      .from("test_attempts")
      .insert({
        test_id: test.id,
        student_id: studentId,
        score,
        total,
        time_taken_sec,
        answers,
        submitted_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    setSubmitting(false);
    if (error) {
      submittedRef.current = false;
      return toast.error(error.message);
    }
    setExisting(data as Attempt);
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

        <h2 className="font-display text-lg font-semibold mt-8 mb-3">Answers</h2>
        <div className="space-y-3">
          {questions.map((q) => {
            const a = attempt.answers?.[q.id] || "";
            const ok = a.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
            return (
              <div
                key={q.id}
                className={`rounded-xl border p-4 ${
                  ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  {ok ? (
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                      Q{q.q_no} · {q.section} · {q.marks} mark{q.marks > 1 ? "s" : ""}
                    </div>
                    <div className="font-medium">{q.question}</div>
                    <div className="mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className={ok ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                          {a || "— not answered —"}
                        </span>
                      </div>
                      {!ok && (
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
