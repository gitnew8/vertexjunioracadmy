import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ClipboardList, Sparkles, Trash2, Eye, Pencil, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickTestBuilder } from "@/components/quick-test-builder";
import { VoiceTestAgent } from "@/components/voice-test-agent";
import { ChatTestBot } from "@/components/chat-test-bot";

export const Route = createFileRoute("/teacher/tests")({
  component: TestsPage,
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
  created_at: string;
  price: number | null;
  discount_price: number | null;
  is_free: boolean | null;
};

function TestsPage() {
  const qc = useQueryClient();
  const location = useLocation();
  const [creating, setCreating] = useState(false);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Test[];
    },
  });

  async function deleteTest(id: string) {
    if (!confirm("Delete this test and all its questions/attempts?")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Test deleted");
    qc.invalidateQueries({ queryKey: ["tests"] });
  }

  async function togglePublish(t: Test) {
    const next = t.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("tests").update({ status: next }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["tests"] });
  }

  if (location.pathname !== "/teacher/tests" && location.pathname.startsWith("/teacher/tests/")) {
    return <Outlet />;
  }

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="size-6" /> Exams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated question papers for your classes.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Sparkles className="size-4" /> Create with AI
        </button>
      </div>

      <ChatTestBot />
      <div className="mb-6">
        <QuickTestBuilder />
      </div>
      <VoiceTestAgent />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="font-display text-xl">No tests yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate your first question paper with AI.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
          >
            <Plus className="size-4" /> Create test
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Class</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Marks</th>
                <th className="text-left p-3">Price</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tests.map((t) => (
                <tr key={t.id} className="hover:bg-secondary/30">
                  <td className="p-3 font-medium">{t.title}</td>
                  <td className="p-3">{t.student_class}</td>
                  <td className="p-3">{t.subject}</td>
                  <td className="p-3">{t.time_limit_min}m</td>
                  <td className="p-3">{t.total_marks}</td>
                  <td className="p-3 text-xs">
                    {t.is_free ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">FREE</span>
                    ) : t.discount_price != null && Number(t.discount_price) < Number(t.price || 0) ? (
                      <span>
                        ₹{t.discount_price} <span className="line-through text-muted-foreground">₹{t.price}</span>
                      </span>
                    ) : (
                      <span>₹{t.price || 0}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === "published"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublish(t)}
                        title={t.status === "published" ? "Unpublish" : "Publish"}
                        className="p-2 rounded-md hover:bg-secondary"
                      >
                        <CheckCircle2 className="size-4" />
                      </button>
                      <Link
                        to="/teacher/tests/$id"
                        params={{ id: t.id }}
                        className="p-2 rounded-md hover:bg-secondary"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Link>
                      <Link
                        to="/teacher/tests/$id"
                        params={{ id: t.id }}
                        search={{ tab: "results" }}
                        className="p-2 rounded-md hover:bg-secondary"
                        title="Results"
                      >
                        <Eye className="size-4" />
                      </Link>
                      <button
                        onClick={() => deleteTest(t.id)}
                        className="p-2 rounded-md hover:bg-secondary text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTestDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

const ALL_TYPES = ["MCQ", "TrueFalse", "OneWord", "Short"] as const;
type QType = (typeof ALL_TYPES)[number];

function CreateTestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"form" | "prompt">("form");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QType[]>(["MCQ"]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [language, setLanguage] = useState<"en" | "hi" | "bilingual">("en");
  const [timeMin, setTimeMin] = useState(30);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState(0);
  const [discountPrice, setDiscountPrice] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  function toggleType(t: QType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    if (!title.trim() || !studentClass.trim() || !subject.trim()) {
      return toast.error("Title, class and subject are required");
    }
    if (types.length === 0) return toast.error("Pick at least one question type");
    if (count < 1 || count > 50) return toast.error("Count must be 1-50");
    if (mode === "prompt" && !prompt.trim()) {
      return toast.error("Please write a prompt for the AI");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_class: studentClass,
          subject,
          chapter: chapter || undefined,
          count,
          types,
          difficulty,
          language,
          prompt: mode === "prompt" ? prompt : undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`AI failed: ${t}`);
      }
      const out = (await res.json()) as {
        questions: Array<{
          section: string;
          question: string;
          options: string[] | null;
          correct_answer: string;
          marks: number;
          difficulty: string;
        }>;
      };
      const qs = (out.questions || []).slice(0, count);
      if (qs.length === 0) throw new Error("AI returned no questions");

      const totalMarks = qs.reduce((s, q) => s + Number(q.marks || 1), 0);
      const { data: test, error: tErr } = await supabase
        .from("tests")
        .insert({
          title,
          student_class: studentClass,
          subject,
          chapter: chapter || null,
          language,
          time_limit_min: timeMin,
          total_marks: totalMarks,
          status: "draft",
          is_free: isFree,
          price: isFree ? 0 : Number(price) || 0,
          discount_price:
            isFree || discountPrice === "" ? null : Number(discountPrice) || null,
        })
        .select("id")
        .single();
      if (tErr || !test) throw new Error(tErr?.message || "Failed to save test");

      const rows = qs.map((q, i) => ({
        test_id: test.id,
        q_no: i + 1,
        section: q.section,
        question: q.question,
        options: q.options ?? null,
        correct_answer: q.correct_answer,
        marks: Number(q.marks || 1),
        difficulty: q.difficulty || difficulty,
      }));
      const { error: qErr } = await supabase.from("test_questions").insert(rows);
      if (qErr) throw new Error(qErr.message);

      toast.success("Test created!");
      qc.invalidateQueries({ queryKey: ["tests"] });
      onClose();
      navigate({ to: "/teacher/tests/$id", params: { id: test.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" /> Create Test with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="inline-flex rounded-lg border border-border p-1 bg-secondary/40 text-xs">
            <button
              type="button"
              onClick={() => setMode("form")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${mode === "form" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Quick form
            </button>
            <button
              type="button"
              onClick={() => setMode("prompt")}
              className={`px-3 py-1.5 rounded-md font-medium transition inline-flex items-center gap-1 ${mode === "prompt" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <Sparkles className="size-3" /> AI Prompt
            </button>
          </div>

          {mode === "prompt" && (
            <Field label="Your prompt to AI">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder={`Example:\n"Class 8 Maths ke Linear Equations chapter ka unit test banao — 5 MCQ + 3 short answer + 2 word problems. Medium difficulty, Hinglish me. Real-life examples use karo."`}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                AI will follow your instructions exactly. Form fields below still set defaults (count, language, types).
              </p>
            </Field>
          )}

          <Field label="Test title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Unit Test 1 — Algebra"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <input
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                placeholder="Class 8"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Subject">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Maths"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Chapter / Topic (optional)">
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Linear Equations"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Questions">
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Time (min)">
              <input
                type="number"
                min={5}
                value={timeMin}
                onChange={(e) => setTimeMin(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
          </div>
          <Field label="Language">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "hi" | "bilingual")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="bilingual">Bilingual</option>
            </select>
          </Field>
          <Field label="Question types">
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_TYPES.map((t) => {
                const on = types.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
              />
              Free test
            </label>
            {!isFree && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Price (₹)">
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Discount price (₹)">
                  <input
                    type="number"
                    min={0}
                    value={discountPrice}
                    onChange={(e) =>
                      setDiscountPrice(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="Optional"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Sparkles className="size-4" />
            {loading ? "Generating…" : "Generate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
