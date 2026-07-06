import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  Key,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { exportTestPaperPDF, exportAnswerKeyPDF, type ExamQuestion } from "@/lib/exam-export";
import { exportToExcel, exportToPDF } from "@/lib/export";

type SearchParams = { tab?: "questions" | "results" };

export const Route = createFileRoute("/teacher/tests/$id")({
  component: TestDetailPage,
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    tab: (s.tab as "questions" | "results") || "questions",
  }),
});

type Test = {
  id: string;
  title: string;
  student_class: string;
  subject: string;
  chapter: string | null;
  language: string;
  time_limit_min: number;
  total_marks: number;
  status: string;
  is_free: boolean | null;
  price: number | null;
  discount_price: number | null;
};

type Question = {
  id: string;
  test_id: string;
  q_no: number;
  section: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  difficulty: string;
};

function TestDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: test } = useQuery({
    queryKey: ["test", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tests").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Test;
    },
  });

  const { data: questions = [] } = useQuery({
    queryKey: ["test-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_questions")
        .select("*")
        .eq("test_id", id)
        .order("q_no");
      if (error) throw error;
      return (data || []) as Question[];
    },
  });

  async function togglePublish() {
    if (!test) return;
    const next = test.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("tests").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["test", id] });
  }

  if (!test) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-5 md:p-8">
      <button
        onClick={() => navigate({ to: "/teacher/tests" })}
        className="text-sm inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-4" /> Back to tests
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{test.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Class {test.student_class} · {test.subject}
            {test.chapter ? ` · ${test.chapter}` : ""} · {test.time_limit_min} min ·{" "}
            {test.total_marks} marks
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportTestPaperPDF(
                test,
                questions.map((q) => ({ ...q })) as ExamQuestion[],
                `${test.title}-paper`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <FileDown className="size-4" /> Paper PDF
          </button>
          <button
            onClick={() =>
              exportAnswerKeyPDF(
                test,
                questions.map((q) => ({ ...q })) as ExamQuestion[],
                `${test.title}-key`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <Key className="size-4" /> Answer key
          </button>
          <button
            onClick={togglePublish}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              test.status === "published"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <CheckCircle2 className="size-4" />
            {test.status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="flex border-b border-border mb-4">
        <TabBtn active={search.tab !== "results"} onClick={() => navigate({ to: "/teacher/tests/$id", params: { id }, search: { tab: "questions" } })}>
          Questions ({questions.length})
        </TabBtn>
        <TabBtn active={search.tab === "results"} onClick={() => navigate({ to: "/teacher/tests/$id", params: { id }, search: { tab: "results" } })}>
          Results
        </TabBtn>
      </div>

      {search.tab === "results" ? (
        <ResultsTab test={test} questions={questions} />
      ) : (
        <QuestionsTab test={test} questions={questions} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionsTab({ test, questions }: { test: Test; questions: Question[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Question | null>(null);

  async function regenerate(q: Question) {
    if (!confirm("Regenerate this question with AI?")) return;
    try {
      const res = await fetch("/api/public/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_class: test.student_class,
          subject: test.subject,
          chapter: test.chapter || undefined,
          count: 1,
          types: [q.section],
          difficulty: q.difficulty || "medium",
          language: test.language,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const out = (await res.json()) as {
        questions: Array<{ section: string; question: string; options: string[] | null; correct_answer: string; marks: number }>;
      };
      const nq = out.questions?.[0];
      if (!nq) throw new Error("AI returned nothing");
      const { error } = await supabase
        .from("test_questions")
        .update({
          question: nq.question,
          options: nq.options,
          correct_answer: nq.correct_answer,
        })
        .eq("id", q.id);
      if (error) throw error;
      toast.success("Regenerated");
      qc.invalidateQueries({ queryKey: ["test-questions", test.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(q: Question) {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("test_questions").delete().eq("id", q.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["test-questions", test.id] });
  }

  return (
    <>
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground mb-1">
                  Q{q.q_no} · {q.section} · {q.marks} mark{q.marks > 1 ? "s" : ""} · {q.difficulty}
                </div>
                <div className="font-medium">{q.question}</div>
                {q.options && (
                  <ul className="mt-2 text-sm space-y-0.5 text-muted-foreground">
                    {q.options.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Answer: </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {q.correct_answer}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditing(q)} className="p-2 rounded-md hover:bg-secondary" title="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => regenerate(q)} className="p-2 rounded-md hover:bg-secondary" title="Regenerate with AI">
                  <RefreshCw className="size-4" />
                </button>
                <button onClick={() => remove(q)} className="p-2 rounded-md hover:bg-secondary text-destructive" title="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditQuestionDialog
          q={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["test-questions", test.id] });
          }}
        />
      )}
    </>
  );
}

function EditQuestionDialog({ q, onClose, onSaved }: { q: Question; onClose: () => void; onSaved: () => void }) {
  const [question, setQuestion] = useState(q.question);
  const [options, setOptions] = useState<string[]>(q.options || []);
  const [correct, setCorrect] = useState(q.correct_answer);
  const [marks, setMarks] = useState(q.marks);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("test_questions")
      .update({
        question,
        options: options.length ? options : null,
        correct_answer: correct,
        marks,
      })
      .eq("id", q.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto"
      >
        <h2 className="font-display text-lg font-semibold mb-3">Edit Q{q.q_no} ({q.section})</h2>
        <label className="text-xs font-medium">Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        {options.length > 0 && (
          <div className="mt-3">
            <label className="text-xs font-medium">Options</label>
            {options.map((o, i) => (
              <input
                key={i}
                value={o}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs font-medium">Correct answer</label>
            <input
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Marks</label>
            <input
              type="number"
              min={1}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm inline-flex items-center gap-1.5"
          >
            <Save className="size-4" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Attempt = {
  id: string;
  student_id: string;
  score: number;
  total: number;
  time_taken_sec: number;
  submitted_at: string | null;
  answers: Record<string, string>;
};

type ResultStudent = {
  id: string;
  name: string;
  roll_number: string;
  student_class: string;
};

function ResultsTab({ test, questions }: { test: Test; questions: Question[] }) {
  const { data: attempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ["test-attempts", test.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("test_id", test.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Attempt[];
    },
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students-for-test-class", test.student_class],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, roll_number, student_class")
        .eq("student_class", test.student_class)
        .order("roll_number", { ascending: true });
      if (error) throw error;
      return (data || []) as ResultStudent[];
    },
  });

  const attemptsByStudent = new Map<string, Attempt>();
  for (const attempt of attempts) {
    if (!attemptsByStudent.has(attempt.student_id)) attemptsByStudent.set(attempt.student_id, attempt);
  }
  const studentRows = students.map((student) => ({ student, attempt: attemptsByStudent.get(student.id) }));
  const orphanAttempts = attempts.filter((attempt) => !students.some((student) => student.id === attempt.student_id));

  // Per-question correct %
  const qStats = questions.map((q) => {
    let correct = 0;
    for (const a of attempts) {
      if (compareAns(a.answers?.[q.id], q.correct_answer)) correct++;
    }
    const pct = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
    return { q, correct, pct };
  });

  function exportResults() {
    const rows = studentRows.map(({ student: s, attempt: a }) => {
      return {
        Student: s.name,
        Roll: s.roll_number,
        Class: s.student_class,
        Score: a ? `${a.score}/${a.total}` : "Not attempted",
        Percent: a?.total ? Math.round((a.score / a.total) * 100) + "%" : "",
        TimeSec: a?.time_taken_sec ?? "",
        Submitted: a?.submitted_at ? new Date(a.submitted_at).toLocaleString() : "",
      };
    });
    exportToExcel(rows, `${test.title}-results`);
  }

  function exportResultsPDF() {
    exportToPDF(
      `${test.title} — Results`,
      ["Student", "Roll", "Score", "%", "Time (s)"],
      studentRows.map(({ student: s, attempt: a }) => {
        return [
          s.name,
          s.roll_number,
          a ? `${a.score}/${a.total}` : "Not attempted",
          a?.total ? Math.round((a.score / a.total) * 100) + "%" : "",
          a?.time_taken_sec ?? "",
        ];
      }),
      `${test.title}-results`,
    );
  }

  if (attemptsLoading || studentsLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-muted-foreground">
          {attempts.length}/{students.length} student{students.length === 1 ? "" : "s"} attempted
        </p>
        {students.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={exportResults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              <FileDown className="size-4" /> Excel
            </button>
            <button
              onClick={exportResultsPDF}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              <FileDown className="size-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No students found for Class {test.student_class}.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card mb-6">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Student</th>
                  <th className="text-left p-3">Roll</th>
                  <th className="text-left p-3">Score</th>
                  <th className="text-left p-3">%</th>
                  <th className="text-left p-3">Time</th>
                  <th className="text-left p-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {studentRows.map(({ student: s, attempt: a }) => {
                  const pct = a?.total ? Math.round((a.score / a.total) * 100) : null;
                  return (
                    <tr key={s.id}>
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3">{s.roll_number}</td>
                      <td className="p-3">
                        {a ? `${a.score}/${a.total}` : <span className="text-muted-foreground">Not attempted</span>}
                      </td>
                      <td className="p-3">
                        {pct === null ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span
                            className={
                              pct >= 60
                                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                : pct >= 35
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-destructive"
                            }
                          >
                            {pct}%
                          </span>
                        )}
                      </td>
                      <td className="p-3">{a ? `${Math.floor(a.time_taken_sec / 60)}m ${a.time_taken_sec % 60}s` : "-"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {a?.submitted_at ? new Date(a.submitted_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 className="font-display font-semibold mb-2">Question-wise analysis</h3>
          <div className="space-y-2">
            {qStats.map(({ q, correct, pct }) => (
              <div key={q.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 truncate">
                    <span className="font-mono text-xs text-muted-foreground">Q{q.q_no}</span>{" "}
                    {q.question}
                  </div>
                  <span className="text-xs font-medium shrink-0">
                    {correct}/{attempts.length} ({pct}%)
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full ${pct >= 60 ? "bg-emerald-500" : pct >= 35 ? "bg-amber-500" : "bg-destructive"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function compareAns(a: string | undefined, correct: string) {
  if (!a) return false;
  return a.trim().toLowerCase() === correct.trim().toLowerCase();
}
