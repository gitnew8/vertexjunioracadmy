import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SubjectEntry, Performance } from "@/lib/types";
import { nanoid } from "nanoid";
import { toast, Toaster } from "sonner";
import { Plus, Trash2, ArrowLeft, Check, Search } from "lucide-react";

type StudentRecord = { name: string; student_class: string; roll_number: string; login_number: string };

function StudentLookup({ onFound }: { onFound: (s: StudentRecord) => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<StudentRecord | null>(null);

  async function lookup() {
    if (!/^\d{6}$/.test(code)) return toast.error("Enter a 6-digit student ID");
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("name, student_class, roll_number, login_number")
      .eq("login_number", code)
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("No student found with that ID");
    setFound(data as StudentRecord);
    onFound(data as StudentRecord);
    toast.success(`Loaded ${data.name}`);
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4">
      <label className="text-sm font-medium block mb-1.5">Student login ID</label>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setFound(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookup())}
          placeholder="123456"
          className={`${inputCls} font-mono tracking-widest`}
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Search className="size-4" /> {loading ? "Loading…" : "Fetch"}
        </button>
      </div>
      {found && (
        <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
          <Check className="size-3 text-[var(--success)]" /> {found.name} · Class {found.student_class} · Roll {found.roll_number}
        </p>
      )}
    </div>
  );
}

export const Route = createFileRoute("/teacher/new")({
  component: NewReport,
  head: () => ({ meta: [{ title: "New report — WeeklyReport" }] }),
});

const PERFORMANCE: Performance[] = ["Good", "Average", "Needs Improvement"];

function emptySubject(): SubjectEntry {
  return { name: "", topics: "", performance: "Good", homework: "Completed", remarks: "" };
}

function NewReport() {
  const navigate = useNavigate();
  const coachingName = "Vertex Junior Academy";
  const logoUrl = "/vertex-logo.png";
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [subjects, setSubjects] = useState<SubjectEntry[]>([emptySubject()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("teacher_name");
    if (t) setTeacherName(t);
  }, []);

  function updateSubject(i: number, patch: Partial<SubjectEntry>) {
    setSubjects((s) => s.map((sub, idx) => (idx === i ? { ...sub, ...patch } : sub)));
  }

  async function save() {
    if (!coachingName.trim()) return toast.error("Coaching name required");
    if (!weekStart || !weekEnd) return toast.error("Week dates required");
    if (!studentName.trim() || !studentClass.trim() || !rollNumber.trim())
      return toast.error("Student details required");
    if (subjects.length === 0 || subjects.some((s) => !s.name.trim()))
      return toast.error("Add at least one subject with a name");

    setSaving(true);
    localStorage.setItem("coaching_name", coachingName);
    if (teacherName) localStorage.setItem("teacher_name", teacherName);

    const code = nanoid(14);
    const { error } = await supabase.from("reports").insert({
      code,
      coaching_name: coachingName,
      logo_url: logoUrl,
      week_start: weekStart,
      week_end: weekEnd,
      student_name: studentName,
      student_class: studentClass,
      roll_number: rollNumber,
      teacher_name: teacherName || null,
      subjects: subjects as any,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Report created");
    navigate({ to: "/report/$code", params: { code } });
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Toaster richColors position="top-center" />
      <Link
        to="/teacher"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="mt-3 font-display text-3xl md:text-4xl font-semibold">New weekly report</h1>

      <Section title="Coaching">
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Vertex Junior Academy"
              className="h-16 w-16 object-contain rounded-md border border-border bg-white p-1"
            />
          )}
          <div>
            <div className="font-display text-lg font-semibold">{coachingName}</div>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
              <Check className="size-3 text-[var(--success)]" /> Brand auto-applied to every report
            </p>
          </div>
        </div>
      </Section>

      <Section title="Week">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Week start">
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Week end">
            <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section title="Student">
        <StudentLookup
          onFound={(s) => {
            setStudentName(s.name);
            setStudentClass(s.student_class);
            setRollNumber(s.roll_number);
          }}
        />
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <Field label="Name">
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Class">
            <input value={studentClass} onChange={(e) => setStudentClass(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Roll number">
            <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Teacher name (optional)">
            <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section
        title="Subjects"
        action={
          <button
            onClick={() => setSubjects((s) => [...s, emptySubject()])}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-sm font-medium hover:bg-accent/40"
          >
            <Plus className="size-4" /> Add subject
          </button>
        }
      >
        <div className="space-y-4">
          {subjects.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Subject {i + 1}
                </span>
                {subjects.length > 1 && (
                  <button
                    onClick={() => setSubjects((arr) => arr.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <Field label="Subject name">
                  <input value={s.name} onChange={(e) => updateSubject(i, { name: e.target.value })} placeholder="e.g. Mathematics" className={inputCls} />
                </Field>
                <Field label="Performance">
                  <select value={s.performance} onChange={(e) => updateSubject(i, { performance: e.target.value as Performance })} className={inputCls}>
                    {PERFORMANCE.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Topics covered" className="md:col-span-2">
                  <textarea value={s.topics} onChange={(e) => updateSubject(i, { topics: e.target.value })} rows={2} className={inputCls} />
                </Field>
                <Field label="Teacher remarks" className="md:col-span-2">
                  <textarea value={s.remarks} onChange={(e) => updateSubject(i, { remarks: e.target.value })} rows={2} className={inputCls} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="mt-8 flex items-center justify-end gap-3">
        <Link to="/teacher" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary">
          Cancel
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & generate link"}
        </button>
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
