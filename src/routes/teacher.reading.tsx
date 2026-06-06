import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { Mic, CheckCircle2, Loader2, Search } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/teacher/reading")({
  component: TeacherReadingPage,
  head: () => ({ meta: [{ title: "Reading sessions — Vertex Junior Academy" }] }),
});

type Analysis = {
  pronunciation_score: number;
  fluency: string;
  reading_speed: string;
  confidence: string;
  words_per_minute: number;
  common_mistakes: string[];
  improvement_tips: string[];
  overall_grade: string;
  summary: string;
};

type Row = {
  id: string;
  student_name: string;
  student_class: string;
  language: string;
  book_name: string;
  audio_path: string;
  duration_sec: number;
  transcript: string | null;
  ai_analysis: Analysis;
  teacher_feedback: string | null;
  approved: boolean;
  created_at: string;
};

function TeacherReadingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reading_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data || []) as unknown as Row[]);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.student_name.toLowerCase().includes(s) ||
        r.student_class.toLowerCase().includes(s) ||
        r.book_name.toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <AdminShell>
      <Toaster richColors position="top-center" />
      <div className="mx-auto max-w-7xl px-5 py-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Mic className="size-6 text-primary" /> Reading sessions
            </h1>
            <p className="text-sm text-muted-foreground">
              Listen to student recordings, review AI analysis, and approve.
            </p>
          </div>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, class, book…"
              className="pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background w-72"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold">
              {loading ? "Loading…" : `${filtered.length} sessions`}
            </div>
            <ul className="max-h-[70vh] overflow-auto divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-4 py-3 hover:bg-secondary/50 ${
                      selected?.id === r.id ? "bg-secondary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">{r.student_name}</div>
                      {r.approved && <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.student_class} · {r.book_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(r.created_at).toLocaleString()} · Grade {r.ai_analysis?.overall_grade || "?"}
                    </div>
                  </button>
                </li>
              ))}
              {!loading && filtered.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No reading sessions yet.
                </li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <SessionDetail row={selected} onChanged={load} />
            ) : (
              <div className="rounded-2xl border border-border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
                Select a session to review.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function SessionDetail({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [url, setUrl] = useState<string>("");
  const [feedback, setFeedback] = useState(row.teacher_feedback || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFeedback(row.teacher_feedback || "");
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("reading-audio")
        .createSignedUrl(row.audio_path, 3600);
      if (!cancelled) setUrl(data?.signedUrl || "");
    })();
    return () => { cancelled = true; };
  }, [row.id, row.audio_path, row.teacher_feedback]);

  async function save(approve = false) {
    setSaving(true);
    const { error } = await supabase
      .from("reading_sessions")
      .update({
        teacher_feedback: feedback,
        approved: approve ? true : row.approved,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Approved" : "Feedback saved");
    onChanged();
  }

  const a = row.ai_analysis || ({} as Analysis);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{row.student_name}</h2>
          <div className="text-xs text-muted-foreground">
            {row.student_class} · {row.book_name} · {row.language.toUpperCase()} · {row.duration_sec}s
          </div>
        </div>
        <span className="text-3xl font-bold font-display text-primary">
          {a.overall_grade || "—"}
        </span>
      </div>

      {url ? (
        <audio controls src={url} className="mt-3 w-full" />
      ) : (
        <div className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" /> Loading audio…
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Pronunciation" value={`${a.pronunciation_score ?? "—"}/10`} />
        <Stat label="Fluency" value={a.fluency || "—"} />
        <Stat label="Speed" value={a.reading_speed || "—"} sub={`${a.words_per_minute || 0} wpm`} />
        <Stat label="Confidence" value={a.confidence || "—"} />
      </div>

      {a.summary && <p className="mt-4 text-sm">{a.summary}</p>}

      {a.common_mistakes?.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-semibold">Common mistakes</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {a.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {a.improvement_tips?.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-semibold">Improvement tips</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {a.improvement_tips.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {row.transcript && (
        <details className="mt-4">
          <summary className="text-sm font-semibold cursor-pointer">Transcript</summary>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{row.transcript}</p>
        </details>
      )}

      <div className="mt-5">
        <label className="text-sm font-semibold">Teacher feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="Add a short note for the student / parent…"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save feedback"}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || row.approved}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="size-4" />
            {row.approved ? "Approved" : "Approve result"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-base font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
