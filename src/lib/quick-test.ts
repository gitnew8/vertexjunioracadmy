import { supabase } from "@/integrations/supabase/client";

export type QuickSpec = {
  student_class: string;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  count?: number | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  language?: "en" | "hi" | "bilingual" | null;
  time_limit_min?: number | null;
  title?: string | null;
};

export type GeneratedQ = {
  section: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  difficulty: string;
};

export function specTitle(spec: QuickSpec) {
  const bits = [spec.student_class, spec.subject];
  const scope = spec.topic || spec.chapter;
  if (scope) bits.push(scope);
  return `${bits.join(" — ")} Test`;
}

/** Generates questions with AI and saves a draft test. Returns the new test id. */
export async function createQuickTest(spec: QuickSpec): Promise<string> {
  const count = Math.min(Math.max(Number(spec.count || 10), 1), 50);
  const difficulty = spec.difficulty || "medium";
  const language = spec.language || "en";
  const time = Number(spec.time_limit_min || Math.max(10, count * 1.5));
  const chapter = [spec.chapter, spec.topic].filter(Boolean).join(" — ") || undefined;

  const res = await fetch("/api/public/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_class: spec.student_class,
      subject: spec.subject,
      chapter,
      count,
      types: ["MCQ"],
      difficulty,
      language,
      prompt: spec.topic
        ? `Focus strictly on the topic "${spec.topic}" from chapter "${spec.chapter || ""}". Age-appropriate for ${spec.student_class}.`
        : undefined,
    }),
  });
  if (!res.ok) throw new Error(await res.text());

  const out = (await res.json()) as { questions: GeneratedQ[] };
  const qs = (out.questions || []).slice(0, count);
  if (!qs.length) throw new Error("AI returned no questions");

  const totalMarks = qs.reduce((s, q) => s + Number(q.marks || 1), 0);
  const { data: test, error } = await supabase
    .from("tests")
    .insert({
      title: spec.title?.trim() || specTitle(spec),
      student_class: spec.student_class,
      subject: spec.subject,
      chapter: chapter || null,
      language,
      time_limit_min: Math.round(time),
      total_marks: totalMarks,
      status: "draft",
      is_free: true,
      price: 0,
    })
    .select("id")
    .single();
  if (error || !test) throw new Error(error?.message || "Could not save test");

  const rows = qs.map((q, i) => ({
    test_id: test.id,
    q_no: i + 1,
    section: q.section || "MCQ",
    question: q.question,
    options: q.options ?? null,
    correct_answer: q.correct_answer,
    marks: Number(q.marks || 1),
    difficulty: q.difficulty || difficulty,
  }));
  const { error: qErr } = await supabase.from("test_questions").insert(rows);
  if (qErr) throw new Error(qErr.message);

  return test.id as string;
}
