import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { useCurriculum } from "@/lib/custom-curriculum";
import { createQuickTest, specTitle } from "@/lib/quick-test";

const ALL_TOPICS = "__all__";

export function QuickTestBuilder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { classes, subjectsFor, chaptersFor, topicsFor } = useCurriculum();
  const [cls, setCls] = useState<string>("Class 5");
  const [subject, setSubject] = useState<string>("Maths");
  const [chapter, setChapter] = useState<string>("");
  const [topic, setTopic] = useState<string>(ALL_TOPICS);
  const [customChapter, setCustomChapter] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [language, setLanguage] = useState<"en" | "hi" | "bilingual">("en");
  const [busy, setBusy] = useState(false);

  const subjects = useMemo(() => subjectsFor(cls), [cls, subjectsFor]);
  const chapters = useMemo(() => chaptersFor(cls, subject), [cls, subject, chaptersFor]);
  const topics = useMemo(
    () => topicsFor(cls, subject, chapter),
    [cls, subject, chapter, topicsFor]
  );

  function pickClass(next: string) {
    setCls(next);
    const subs = subjectsFor(next);
    const nextSubject = subs.includes(subject) ? subject : subs[0] || "";
    setSubject(nextSubject);
    setChapter("");
    setTopic(ALL_TOPICS);
  }

  function pickSubject(next: string) {
    setSubject(next);
    setChapter("");
    setTopic(ALL_TOPICS);
  }

  const effectiveChapter = customChapter.trim() || chapter;

  async function generate() {
    if (!cls || !subject) return toast.error("Class aur subject chuniye");
    setBusy(true);
    const t = toast.loading("AI test bana raha hai…");
    try {
      const id = await createQuickTest({
        student_class: cls,
        subject,
        chapter: effectiveChapter || null,
        topic: topic !== ALL_TOPICS ? topic : null,
        count,
        difficulty,
        language,
      });
      toast.success("Test ready!", { id: t });
      qc.invalidateQueries({ queryKey: ["tests"] });
      navigate({ to: "/teacher/tests/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    } finally {
      setBusy(false);
    }
  }

  const previewTitle = specTitle({
    student_class: cls,
    subject,
    chapter: effectiveChapter,
    topic: topic !== ALL_TOPICS ? topic : null,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="size-5 text-amber-500" />
        <h2 className="font-display text-lg font-semibold">1-Click Instant Test</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Class → Subject → Chapter → Topic chuniye, 1 click me paper taiyar.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Class" value={cls} onChange={pickClass} options={classes} />
        <Select label="Subject" value={subject} onChange={pickSubject} options={subjects} />
        <Select
          label="Chapter"
          value={chapter}
          onChange={(v) => {
            setChapter(v);
            setTopic(ALL_TOPICS);
          }}
          options={chapters.map((c) => c.name)}
          placeholder="Full subject (all chapters)"
        />
        <Select
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={topics}
          allLabel="Poora chapter (all topics)"
          allValue={ALL_TOPICS}
          disabled={!chapter || topics.length === 0}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
        <label className="text-xs font-medium">
          <span className="text-muted-foreground">Custom chapter (optional)</span>
          <input
            value={customChapter}
            onChange={(e) => setCustomChapter(e.target.value)}
            placeholder="School ki apni book ka chapter"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
          />
        </label>
        <Select
          label="Questions"
          value={String(count)}
          onChange={(v) => setCount(Number(v))}
          options={["5", "10", "15", "20", "25", "30"]}
        />
        <Select
          label="Difficulty"
          value={difficulty}
          onChange={(v) => setDifficulty(v as typeof difficulty)}
          options={["easy", "medium", "hard"]}
        />
        <Select
          label="Language"
          value={language}
          onChange={(v) => setLanguage(v as typeof language)}
          options={["en", "hi", "bilingual"]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {busy ? "Banaya ja raha hai…" : "Generate Test"}
        </button>
        <span className="text-xs text-muted-foreground truncate">{previewTitle}</span>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  allValue,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  allLabel?: string;
  allValue?: string;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-medium">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal disabled:opacity-50"
      >
        {allLabel ? (
          <option value={allValue}>{allLabel}</option>
        ) : placeholder ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
