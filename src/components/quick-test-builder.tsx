import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { useCurriculum } from "@/lib/custom-curriculum";
import { createQuickTest, specTitle } from "@/lib/quick-test";

export function QuickTestBuilder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { classes, subjectsFor, chaptersFor, topicsFor } = useCurriculum();
  const [cls, setCls] = useState<string>("Class 5");
  const [subject, setSubject] = useState<string>("Maths");
  const [selChapters, setSelChapters] = useState<string[]>([]);
  const [selTopics, setSelTopics] = useState<string[]>([]);
  const [customChapter, setCustomChapter] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [language, setLanguage] = useState<"en" | "hi" | "bilingual">("en");
  const [busy, setBusy] = useState(false);

  const subjects = useMemo(() => subjectsFor(cls), [cls, subjectsFor]);
  const chapters = useMemo(() => chaptersFor(cls, subject), [cls, subject, chaptersFor]);
  const topicGroups = useMemo(
    () => selChapters.map((ch) => ({ chapter: ch, topics: topicsFor(cls, subject, ch) })),
    [cls, subject, selChapters, topicsFor]
  );

  function reset() {
    setSelChapters([]);
    setSelTopics([]);
  }
  function pickClass(next: string) {
    setCls(next);
    const subs = subjectsFor(next);
    setSubject(subs.includes(subject) ? subject : subs[0] || "");
    reset();
  }
  function pickSubject(next: string) {
    setSubject(next);
    reset();
  }
  function toggleChapter(ch: string) {
    if (selChapters.includes(ch)) {
      setSelChapters(selChapters.filter((c) => c !== ch));
      const drop = new Set(topicsFor(cls, subject, ch).map((t) => `${ch}::${t}`));
      setSelTopics(selTopics.filter((t) => !drop.has(t)));
    } else setSelChapters([...selChapters, ch]);
  }
  function toggleTopic(key: string) {
    setSelTopics(selTopics.includes(key) ? selTopics.filter((t) => t !== key) : [...selTopics, key]);
  }

  const chapterList = [...selChapters, ...(customChapter.trim() ? [customChapter.trim()] : [])];
  const topicNames = selTopics.map((k) => k.split("::")[1]);
  const chapterStr = chapterList.join(", ");
  const topicStr = topicNames.join(", ");

  async function generate() {
    if (!cls || !subject) return toast.error("Class aur subject chuniye");
    setBusy(true);
    const t = toast.loading("AI test bana raha hai…");
    try {
      const id = await createQuickTest({
        student_class: cls,
        subject,
        chapter: chapterStr || null,
        topic: topicStr || null,
        chapters: chapterList,
        topics: topicNames,
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
    chapter: chapterList.length > 2 ? `${chapterList.length} chapters` : chapterStr,
    topic: topicNames.length > 2 ? `${topicNames.length} topics` : topicStr || null,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="size-5 text-amber-500" />
        <h2 className="font-display text-lg font-semibold">1-Click Instant Test</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Class → Subject chuniye, phir ek ya zyada chapters aur topics par ✓ lagaiye.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Class" value={cls} onChange={pickClass} options={classes} />
        <Select label="Subject" value={subject} onChange={pickSubject} options={subjects} />
      </div>

      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Chapters ({selChapters.length} chune) — koi nahi = poora subject
          </span>
          {chapters.length > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                selChapters.length === chapters.length ? reset() : setSelChapters(chapters.map((c) => c.name))
              }
            >
              {selChapters.length === chapters.length ? "Sab hatao" : "Sab chuno"}
            </button>
          )}
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 max-h-56 overflow-y-auto">
          {chapters.map((c) => (
            <label key={c.name} className="flex items-center gap-2 text-sm rounded-md px-2 py-1 hover:bg-muted cursor-pointer">
              <input type="checkbox" checked={selChapters.includes(c.name)} onChange={() => toggleChapter(c.name)} />
              <span>{c.name}</span>
            </label>
          ))}
          {chapters.length === 0 && <p className="text-xs text-muted-foreground">Is subject me chapters nahi hain.</p>}
        </div>
      </div>

      {topicGroups.some((g) => g.topics.length > 0) && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Topics ({selTopics.length} chune) — koi nahi = chune gaye chapters ke sabhi topics
          </span>
          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
            {topicGroups.filter((g) => g.topics.length).map((g) => (
              <div key={g.chapter}>
                <p className="text-xs font-semibold mb-1">{g.chapter}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.topics.map((tp) => {
                    const key = `${g.chapter}::${tp}`;
                    const on = selTopics.includes(key);
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => toggleTopic(key)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >
                        {on ? "✓ " : ""}{tp}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
