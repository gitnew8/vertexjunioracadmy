import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  MinusCircle,
  Printer,
  Share2,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadAnswerSheetPdf, downloadResultPdf, type ResultPdfRow } from "@/lib/result-pdf";

export type RQuestion = {
  id: string;
  q_no: number;
  section: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  difficulty?: string | null;
  chapter?: string | null;
};

export type RAttempt = {
  id: string;
  score: number;
  total: number;
  time_taken_sec: number;
  submitted_at: string | null;
  answers: Record<string, string>;
  evaluations?: Record<string, { verdict: string; marks: number; feedback: string }>;
};

export type RTest = {
  id: string;
  title: string;
  student_class: string;
  subject: string;
  chapter: string | null;
  total_marks: number;
};

export type RStudent = { name: string; roll_number: string; student_class: string };

type Verdict = "Correct" | "Partial" | "Wrong" | "Skipped";

type AI = {
  strong_topics: string[];
  weak_topics: string[];
  common_mistakes: string[];
  suggestions: string[];
  recommended_chapters: string[];
  recommended_practice: string[];
  readiness_percent: number;
  summary: string;
};

const OK = "hsl(142 71% 42%)";
const BAD = "hsl(0 72% 52%)";
const NEU = "hsl(215 16% 60%)";

function gradeOf(p: number) {
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B+";
  if (p >= 60) return "B";
  if (p >= 45) return "C";
  return "D";
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function ExamResultDashboard({
  test,
  questions,
  attempt,
  student,
}: {
  test: RTest;
  questions: RQuestion[];
  attempt: RAttempt;
  student: RStudent;
}) {
  const [tab, setTab] = useState<"summary" | "analytics" | "review" | "ai">("summary");
  const [idx, setIdx] = useState(0);
  const [ai, setAi] = useState<AI | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [rank, setRank] = useState<{ rank: number; percentile: number; peers: number } | null>(null);

  const rows = useMemo(() => {
    return questions.map((q) => {
      const raw = (attempt.answers?.[q.id] ?? "").toString();
      const attempted = raw.trim().length > 0;
      const ev = attempt.evaluations?.[q.id];
      let verdict: Verdict;
      if (!attempted) verdict = "Skipped";
      else if (ev) verdict = (ev.verdict as Verdict) || "Wrong";
      else
        verdict =
          raw.trim().toLowerCase() === q.correct_answer.trim().toLowerCase() ? "Correct" : "Wrong";
      const awarded = ev?.marks ?? (verdict === "Correct" ? q.marks : 0);
      return { q, raw, attempted, verdict, awarded, feedback: ev?.feedback ?? "" };
    });
  }, [questions, attempt]);

  const stats = useMemo(() => {
    const totalQ = rows.length;
    const attempted = rows.filter((r) => r.attempted).length;
    const correct = rows.filter((r) => r.verdict === "Correct").length;
    const partial = rows.filter((r) => r.verdict === "Partial").length;
    const incorrect = rows.filter((r) => r.verdict === "Wrong").length;
    const skipped = totalQ - attempted;
    const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
    const accuracy = attempted ? Math.round(((correct + partial * 0.5) / attempted) * 100) : 0;
    const avgTime = totalQ ? Math.round(attempt.time_taken_sec / totalQ) : 0;
    return {
      totalQ,
      attempted,
      correct,
      partial,
      incorrect,
      skipped,
      pct,
      accuracy,
      avgTime,
      passed: pct >= 35,
      grade: gradeOf(pct),
    };
  }, [rows, attempt]);

  // Rank & percentile among peers on the same test
  useEffect(() => {
    let dead = false;
    (async () => {
      const { data } = await supabase
        .from("test_attempts")
        .select("id, score")
        .eq("test_id", test.id)
        .not("submitted_at", "is", null);
      if (dead || !data || data.length < 2) return;
      const sorted = [...data].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const r = sorted.findIndex((a) => a.id === attempt.id);
      if (r < 0) return;
      const below = sorted.filter((a) => (a.score ?? 0) < attempt.score).length;
      setRank({
        rank: r + 1,
        percentile: Math.round((below / sorted.length) * 100),
        peers: sorted.length,
      });
    })();
    return () => {
      dead = true;
    };
  }, [test.id, attempt.id, attempt.score]);

  const byDifficulty = useMemo(() => {
    const map: Record<string, { name: string; correct: number; wrong: number; skipped: number }> = {};
    for (const r of rows) {
      const k = (r.q.difficulty || "Medium").toString();
      map[k] = map[k] || { name: k, correct: 0, wrong: 0, skipped: 0 };
      if (r.verdict === "Skipped") map[k].skipped++;
      else if (r.verdict === "Wrong") map[k].wrong++;
      else map[k].correct++;
    }
    return Object.values(map);
  }, [rows]);

  const bySection = useMemo(() => {
    const map: Record<string, { name: string; scored: number; max: number }> = {};
    for (const r of rows) {
      const k = r.q.section || "General";
      map[k] = map[k] || { name: k, scored: 0, max: 0 };
      map[k].scored += r.awarded;
      map[k].max += r.q.marks;
    }
    return Object.values(map).map((s) => ({
      ...s,
      percent: s.max ? Math.round((s.scored / s.max) * 100) : 0,
    }));
  }, [rows]);

  const pieData = [
    { name: "Correct", value: stats.correct, color: OK },
    { name: "Incorrect", value: stats.incorrect, color: BAD },
    { name: "Not attempted", value: stats.skipped, color: NEU },
  ].filter((d) => d.value > 0);

  const pdfMeta = {
    student_name: student.name,
    roll_number: student.roll_number,
    student_class: student.student_class,
    test_title: test.title,
    subject: test.subject,
    date: attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "—",
    total_questions: stats.totalQ,
    attempted: stats.attempted,
    correct: stats.correct,
    incorrect: stats.incorrect,
    score: attempt.score,
    total: attempt.total,
    percentage: stats.pct,
    accuracy: stats.accuracy,
    time_taken_sec: attempt.time_taken_sec,
    grade: stats.grade,
    passed: stats.passed,
    rank: rank?.rank ?? null,
    percentile: rank?.percentile ?? null,
  };

  const pdfRows: ResultPdfRow[] = rows.map((r) => ({
    q_no: r.q.q_no,
    question: r.q.question,
    your_answer: r.raw || "Not attempted",
    correct_answer: r.q.correct_answer,
    verdict: r.verdict,
    marks: `${r.awarded}/${r.q.marks}`,
  }));

  async function runAi() {
    if (ai || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/public/result-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_class: test.student_class,
          subject: test.subject,
          test_title: test.title,
          percentage: stats.pct,
          accuracy: stats.accuracy,
          items: rows.map((r) => ({
            q_no: r.q.q_no,
            question: r.q.question,
            section: r.q.section,
            difficulty: r.q.difficulty || null,
            topic: r.q.chapter || test.chapter || null,
            correct: r.verdict === "Correct",
            attempted: r.attempted,
            your_answer: r.raw,
            correct_answer: r.q.correct_answer,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "AI failed");
      setAi(json as AI);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "ai") void runAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function share() {
    const text = `${student.name} scored ${attempt.score}/${attempt.total} (${stats.pct}%, Grade ${stats.grade}) in ${test.title}.`;
    try {
      if (navigator.share) await navigator.share({ title: test.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Result copied");
      }
    } catch {
      /* cancelled */
    }
  }

  const cur = rows[idx];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background print:bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur sticky top-0 z-20 print:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/student"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> My tests
          </Link>
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={() => downloadResultPdf(pdfMeta, pdfRows)} icon={Download} label="Result PDF" />
            <IconBtn
              onClick={() => downloadAnswerSheetPdf(pdfMeta, pdfRows)}
              icon={FileText}
              label="Answer sheet"
            />
            <IconBtn onClick={() => window.print()} icon={Printer} label="Print" />
            <IconBtn onClick={share} icon={Share2} label="Share" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* ===== Result summary card ===== */}
        <section
          className={`relative overflow-hidden rounded-3xl border p-6 md:p-8 shadow-[var(--shadow-soft)] animate-in fade-in slide-in-from-bottom-3 duration-500 ${
            stats.passed
              ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-card"
              : "border-red-500/40 bg-gradient-to-br from-red-500/10 via-card to-card"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Official result
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold mt-1">{test.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {student.name} · Roll {student.roll_number} · Class {student.student_class} ·{" "}
                {test.subject}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`rounded-2xl px-4 py-3 text-center ${
                  stats.passed
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide">Status</div>
                <div className="font-display text-2xl font-bold">{stats.passed ? "PASS" : "FAIL"}</div>
              </div>
              <div className="rounded-2xl bg-primary/10 text-primary px-4 py-3 text-center">
                <div className="text-[10px] uppercase tracking-wide">Grade</div>
                <div className="font-display text-2xl font-bold flex items-center gap-1">
                  <Award className="size-5" />
                  {stats.grade}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between text-sm">
              <span className="text-muted-foreground">Marks obtained</span>
              <span className="font-display text-3xl font-bold">
                {attempt.score}
                <span className="text-base text-muted-foreground">/{attempt.total}</span>
              </span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ${
                  stats.passed ? "bg-emerald-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, stats.pct)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-muted-foreground">{stats.pct}%</div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Metric label="Total questions" value={stats.totalQ} />
            <Metric label="Attempted" value={stats.attempted} />
            <Metric label="Not attempted" value={stats.skipped} tone="neutral" />
            <Metric label="Correct" value={stats.correct} tone="ok" />
            <Metric label="Incorrect" value={stats.incorrect} tone="bad" />
            <Metric label="Accuracy" value={`${stats.accuracy}%`} />
            <Metric label="Time taken" value={fmtDuration(attempt.time_taken_sec)} />
            <Metric label="Avg / question" value={`${stats.avgTime}s`} />
            <Metric label="Rank" value={rank ? `#${rank.rank} / ${rank.peers}` : "—"} />
            <Metric label="Percentile" value={rank ? `${rank.percentile}` : "—"} />
            <Metric label="Percentage" value={`${stats.pct}%`} />
            <Metric label="Subject" value={test.subject} />
          </div>
        </section>

        {/* ===== Tabs ===== */}
        <nav className="flex gap-1 rounded-xl border border-border bg-card p-1 text-sm print:hidden">
          {(
            [
              ["summary", "Overview", Trophy],
              ["analytics", "Analytics", BarChart3],
              ["review", "Question review", FileText],
              ["ai", "AI report", BrainCircuit],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-medium transition ${
                tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {tab === "summary" && (
          <section className="grid md:grid-cols-2 gap-4">
            <Card title="Correct vs incorrect">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Question palette">
              <Palette rows={rows} current={-1} onPick={(i) => { setIdx(i); setTab("review"); }} />
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <LegendDot color="bg-emerald-500" label="Correct" />
                <LegendDot color="bg-red-500" label="Wrong" />
                <LegendDot color="bg-muted-foreground/40" label="Not attempted" />
              </div>
            </Card>
          </section>
        )}

        {tab === "analytics" && (
          <section className="grid md:grid-cols-2 gap-4">
            <Card title="Marks distribution (section-wise)">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySection}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="scored" name="Scored" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="max" name="Maximum" fill={NEU} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Difficulty-wise performance">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDifficulty}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="correct" name="Correct" stackId="a" fill={OK} />
                    <Bar dataKey="wrong" name="Wrong" stackId="a" fill={BAD} />
                    <Bar dataKey="skipped" name="Skipped" stackId="a" fill={NEU} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Subject / section strength">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={bySection}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" fontSize={11} />
                    <Radar
                      dataKey="percent"
                      name="% scored"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.35}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Time analysis">
              <div className="space-y-3 text-sm">
                <Bar2 label="Total time used" value={fmtDuration(attempt.time_taken_sec)} pct={100} />
                <Bar2
                  label="Average per question"
                  value={`${stats.avgTime}s`}
                  pct={Math.min(100, stats.avgTime)}
                />
                <Bar2 label="Accuracy" value={`${stats.accuracy}%`} pct={stats.accuracy} />
                <Bar2 label="Attempt rate" value={`${stats.totalQ ? Math.round((stats.attempted / stats.totalQ) * 100) : 0}%`} pct={stats.totalQ ? (stats.attempted / stats.totalQ) * 100 : 0} />
              </div>
            </Card>
          </section>
        )}

        {tab === "review" && cur && (
          <section className="space-y-4">
            <Card title="Question palette">
              <Palette rows={rows} current={idx} onPick={setIdx} />
            </Card>

            <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                <span>
                  Question {idx + 1} of {rows.length} · {cur.q.section}
                  {cur.q.difficulty ? ` · ${cur.q.difficulty}` : ""}
                  {cur.q.chapter || test.chapter ? ` · ${cur.q.chapter || test.chapter}` : ""}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {cur.awarded}/{cur.q.marks} marks
                  </span>
                  <VerdictChip verdict={cur.verdict} />
                </span>
              </div>

              <p className="mt-3 font-medium text-lg">
                Q{cur.q.q_no}. {cur.q.question}
              </p>

              {cur.q.options && cur.q.options.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {cur.q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = cur.q.correct_answer.trim().toLowerCase() === letter.toLowerCase();
                    const isPicked = cur.raw.trim().toLowerCase() === letter.toLowerCase();
                    const cls = isCorrect
                      ? "border-emerald-500 bg-emerald-500/10"
                      : isPicked
                        ? "border-red-500 bg-red-500/10"
                        : "border-border";
                    return (
                      <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        <span className="font-semibold w-5">{letter}.</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />}
                        {isPicked && !isCorrect && <XCircle className="size-4 text-red-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Your answer</div>
                  <div
                    className={`mt-0.5 font-medium whitespace-pre-wrap ${
                      cur.verdict === "Correct"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : cur.attempted
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {cur.raw || "Not attempted"}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Correct answer</div>
                  <div className="mt-0.5 font-medium text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                    {cur.q.correct_answer}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Result</div>
                  <div className="mt-0.5 font-medium">{cur.verdict}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Marks awarded</div>
                  <div className="mt-0.5 font-medium">
                    {cur.awarded} / {cur.q.marks}
                    <span className="text-muted-foreground text-xs"> · negative marking: none</span>
                  </div>
                </div>
              </div>

              {cur.feedback && (
                <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 inline-flex items-center gap-1">
                    <Sparkles className="size-3" /> Explanation & solution
                  </div>
                  {cur.feedback}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between gap-2 print:hidden">
                <button
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  <ArrowLeft className="size-4" /> Previous
                </button>
                <button
                  onClick={() => setIdx((i) => Math.min(rows.length - 1, i + 1))}
                  disabled={idx >= rows.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  Next <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "ai" && (
          <section className="space-y-4">
            {aiLoading && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                AI aapki performance analyse kar raha hai…
              </div>
            )}
            {!aiLoading && !ai && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center">
                <button
                  onClick={runAi}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
                >
                  Generate AI report
                </button>
              </div>
            )}
            {ai && (
              <>
                <Card title="Exam readiness">
                  <div className="flex items-center gap-4">
                    <div className="relative size-24 shrink-0">
                      <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15.9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          className="text-primary transition-all duration-1000"
                          strokeDasharray={`${Math.min(100, ai.readiness_percent)} 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 grid place-items-center font-display text-xl font-bold">
                        {Math.round(ai.readiness_percent)}%
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{ai.summary}</p>
                  </div>
                </Card>
                <div className="grid md:grid-cols-2 gap-4">
                  <ListCard title="Strong topics" items={ai.strong_topics} icon={Target} tone="ok" />
                  <ListCard title="Weak topics" items={ai.weak_topics} icon={Target} tone="bad" />
                  <ListCard title="Common mistakes" items={ai.common_mistakes} icon={XCircle} tone="bad" />
                  <ListCard title="Improvement suggestions" items={ai.suggestions} icon={Sparkles} />
                  <ListCard title="Recommended chapters" items={ai.recommended_chapters} icon={FileText} />
                  <ListCard
                    title="Recommended practice tests"
                    items={ai.recommended_practice}
                    icon={Clock}
                  />
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function IconBtn({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
    >
      <Icon className="size-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "bad" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : tone === "neutral"
          ? "text-muted-foreground"
          : "";
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-lg font-semibold truncate ${cls}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 rounded ${color}`} /> {label}
    </span>
  );
}

function Bar2({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const map: Record<Verdict, string> = {
    Correct: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    Partial: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Wrong: "bg-red-500/15 text-red-700 dark:text-red-400",
    Skipped: "bg-muted text-muted-foreground",
  };
  const Icon = verdict === "Correct" ? CheckCircle2 : verdict === "Skipped" ? MinusCircle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${map[verdict]}`}>
      <Icon className="size-3" /> {verdict}
    </span>
  );
}

function Palette({
  rows,
  current,
  onPick,
}: {
  rows: { verdict: Verdict }[];
  current: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((r, i) => {
        const cls =
          r.verdict === "Correct"
            ? "bg-emerald-500 text-white"
            : r.verdict === "Wrong" || r.verdict === "Partial"
              ? "bg-red-500 text-white"
              : "bg-muted text-muted-foreground";
        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`size-9 rounded-lg text-sm font-semibold transition hover:scale-105 ${cls} ${
              current === i ? "ring-2 ring-offset-2 ring-primary ring-offset-background" : ""
            }`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function ListCard({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: React.ComponentType<{ className?: string }>;
  tone?: "ok" | "bad";
}) {
  const color =
    tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className={`font-display font-semibold mb-2 inline-flex items-center gap-1.5 ${color}`}>
        <Icon className="size-4" /> {title}
      </h3>
      {items?.length ? (
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
