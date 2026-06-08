import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Square, ArrowLeft, BookOpen, Loader2, Play, Award } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/student/reading")({
  component: ReadingPage,
  head: () => ({ meta: [{ title: "Reading practice — Vertex Junior Academy" }] }),
});

const SESSION_KEY = "student_session_v2";
type Session = { name: string; student_class: string; roll_number: string; login_number: string };

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

const CLASSES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);

function ReadingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [studentClass, setStudentClass] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [bookName, setBookName] = useState("");

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ analysis: Analysis; audioUrl: string } | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Session;
      setSession(s);
      setStudentClass(s.student_class || "");
    }
  }, []);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const MAX_SEC = 600; // 10 minutes

  async function start() {
    if (!studentClass) return toast.error("Please choose your class");
    if (!bookName.trim()) return toast.error("Enter your book name");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = mr;
      mr.start();
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setResult(null);
      tickRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(s);
        if (s >= MAX_SEC) {
          toast.info("10 minute limit reached — submitting…");
          stopAndSubmit();
        }
      }, 500);
    } catch (e: any) {
      toast.error(e?.message || "Microphone not available");
    }
  }

  async function stopAndSubmit() {
    if (!mediaRef.current || busy) return;
    if (mediaRef.current.state === "inactive") return;
    setBusy(true);
    setRecording(false);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const durationSec = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000));


    const blob: Blob = await new Promise((resolve) => {
      mediaRef.current!.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRef.current!.stream.getTracks().forEach((t) => t.stop());
        resolve(b);
      };
      mediaRef.current!.stop();
    });

    try {
      // 1) Upload audio
      const ts = Date.now();
      const safeName = (session?.name || "student").replace(/[^a-z0-9-_]+/gi, "_");
      const path = `${safeName}/${ts}.webm`;
      const { error: upErr } = await supabase.storage
        .from("reading-audio")
        .upload(path, blob, { contentType: "audio/webm", upsert: false });
      if (upErr) throw upErr;

      // 2) Analyze
      const fd = new FormData();
      fd.append("audio", blob, "reading.webm");
      fd.append("language", language);
      fd.append("student_class", studentClass);
      fd.append("book_name", bookName.trim());
      fd.append("duration_sec", String(durationSec));

      const res = await fetch("/api/public/analyze-reading", { method: "POST", body: fd });
      if (!res.ok) {
        const eText = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(eText); } catch {}
        const msg = errData.error || eText || "Analysis failed";
        if (errData.fix) {
          toast.error(msg, { description: errData.fix });
        } else {
          toast.error(msg);
        }
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { transcript: string; analysis: Analysis };

      // 3) Save session
      let studentId: string | null = null;
      if (session?.login_number) {
        const { data: stu } = await supabase
          .from("students")
          .select("id")
          .eq("login_number", session.login_number)
          .maybeSingle();
        studentId = stu?.id ?? null;
      }

      await supabase.from("reading_sessions").insert({
        student_id: studentId,
        student_name: session?.name || "Guest",
        student_class: studentClass,
        language,
        book_name: bookName.trim(),
        audio_path: path,
        duration_sec: durationSec,
        transcript: data.transcript,
        ai_analysis: data.analysis as never,
      });

      // 4) Signed URL for playback
      const { data: signed } = await supabase.storage
        .from("reading-audio")
        .createSignedUrl(path, 3600);

      setResult({ analysis: data.analysis, audioUrl: signed?.signedUrl || "" });
      toast.success("Recording analyzed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to analyze");
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between">
          <Link to="/student" className="inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="font-display font-semibold flex items-center gap-2">
            <BookOpen className="size-5 text-primary" /> Reading practice
          </div>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-xl font-semibold">Read aloud from your book</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick your class and language, type the book name, then press the big mic and start reading.
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Class</label>
              <select
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                disabled={recording || busy}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select class…</option>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Language</label>
              <div className="mt-1 flex gap-2">
                {(["en", "hi"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    disabled={recording || busy}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border ${
                      language === l
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    {l === "en" ? "English" : "Hindi"}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Book name</label>
              <input
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                disabled={recording || busy}
                placeholder="e.g. NCERT Marigold Class 2"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <button
              onClick={recording ? stopAndSubmit : start}
              disabled={busy}
              className={`size-32 rounded-full grid place-items-center text-white text-lg font-semibold shadow-xl transition-transform active:scale-95 ${
                recording
                  ? "bg-red-600 animate-pulse"
                  : "bg-gradient-to-br from-primary to-primary/70"
              } disabled:opacity-60`}
            >
              {busy ? (
                <Loader2 className="size-10 animate-spin" />
              ) : recording ? (
                <Square className="size-10" />
              ) : (
                <Mic className="size-12" />
              )}
            </button>
            <div className="mt-4 font-mono text-2xl tabular-nums">
              {mm}:{ss}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {busy
                ? "Analyzing your reading…"
                : recording
                ? "Recording… tap to Stop & Submit"
                : "Tap the mic to Start Recording"}
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Award className="size-5 text-primary" /> Your reading report
              </h2>
              <span className="text-3xl font-bold font-display text-primary">
                {result.analysis.overall_grade}
              </span>
            </div>

            {result.audioUrl && (
              <div className="mt-3">
                <audio controls src={result.audioUrl} className="w-full" />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Pronunciation" value={`${result.analysis.pronunciation_score}/10`} />
              <Stat label="Fluency" value={result.analysis.fluency} />
              <Stat label="Speed" value={`${result.analysis.reading_speed}`} sub={`${result.analysis.words_per_minute} wpm`} />
              <Stat label="Confidence" value={result.analysis.confidence} />
            </div>

            <p className="mt-4 text-sm">{result.analysis.summary}</p>

            {result.analysis.common_mistakes?.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold">Common mistakes</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {result.analysis.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}

            {result.analysis.improvement_tips?.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold">Tips to improve</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {result.analysis.improvement_tips.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
