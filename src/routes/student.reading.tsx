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
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "uploading" | "done">("idle");
  const [result, setResult] = useState<{ analysis: Analysis; audioUrl: string } | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const mimeRef = useRef<string>("audio/webm");

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
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const MAX_SEC = 600; // 10 minutes

  function pickMime() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return "";
  }

  /** Creates a MediaRecorder on the live stream. Auto-restarts if it dies early. */
  function attachRecorder(stream: MediaStream) {
    const mime = pickMime();
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    mimeRef.current = (mr.mimeType || mime || "audio/webm").split(";")[0];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        console.log("[reading] audio chunk received", e.data.size, "bytes; total chunks", chunksRef.current.length);
      }
    };
    mr.onerror = (e: any) => {
      console.error("[reading] MediaRecorder error", e?.error || e);
      if (!stoppingRef.current) restartRecorder("recorder error");
    };
    mr.onstop = () => {
      if (!stoppingRef.current) {
        console.warn("[reading] unexpected stop — recorder ended before user pressed Stop");
        restartRecorder("unexpected stop");
      }
    };
    // timeslice keeps data flowing so nothing is lost if the recorder dies mid-session
    mr.start(1000);
    mediaRef.current = mr;
    console.log("[reading] recorder started; mimeType =", mr.mimeType);
  }

  function restartRecorder(reason: string) {
    const stream = streamRef.current;
    if (!stream || stoppingRef.current) return;
    const live = stream.getAudioTracks().some((t) => t.readyState === "live");
    if (!live) {
      console.error("[reading] microphone track ended:", reason);
      toast.error("Microphone disconnected", { description: "Tap the mic again to resume — your audio so far is safe." });
      return;
    }
    console.log("[reading] restarting recorder after:", reason);
    try {
      attachRecorder(stream);
      toast.info("Recording resumed automatically");
    } catch (err) {
      console.error("[reading] restart failed", err);
    }
  }

  async function start() {
    if (!studentClass) return toast.error("Please choose your class");
    if (!bookName.trim()) return toast.error("Enter your book name");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      stoppingRef.current = false;

      stream.getAudioTracks().forEach((t) => {
        t.onended = () => {
          console.warn("[reading] audio track ended");
          if (!stoppingRef.current) {
            toast.error("Microphone stopped", { description: "Check mic permission, then tap Stop to submit what was recorded." });
          }
        };
      });

      attachRecorder(stream);
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setStatus("recording");
      setResult(null);
      console.log("[reading] recording started at", new Date().toISOString(), "· max", MAX_SEC, "s");

      tickRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(s);
        // keep the recorder alive if the browser silently killed it
        if (!stoppingRef.current && mediaRef.current && mediaRef.current.state === "inactive") {
          restartRecorder("watchdog found inactive recorder");
        }
        if (s >= MAX_SEC) {
          console.log("[reading] 10 minute limit reached — auto submitting");
          toast.info("10 minute limit reached — submitting…");
          stopAndSubmit();
        }
      }, 500);
    } catch (e: any) {
      console.error("[reading] getUserMedia failed", e);
      toast.error(e?.message || "Microphone not available", {
        description: "Allow microphone access in your browser and try again.",
      });
    }
  }

  async function stopAndSubmit() {
    if (busy || stoppingRef.current) return;
    const mr = mediaRef.current;
    if (!mr) return;
    stoppingRef.current = true;
    setBusy(true);
    setRecording(false);
    setStatus("processing");
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const durationSec = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000));
    console.log("[reading] stopping. duration =", durationSec, "s");

    const blob: Blob = await new Promise((resolve) => {
      const finish = () => {
        const b = new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        console.log("[reading] final blob", b.size, "bytes from", chunksRef.current.length, "chunks");
        resolve(b);
      };
      if (mr.state === "inactive") return finish();
      mr.onstop = finish;
      mr.stop();
    });

    if (blob.size < 2048) {
      console.warn("[reading] recording too small", blob.size);
      toast.error("That recording was empty — please try again.");
      setBusy(false);
      setStatus("idle");
      return;
    }

    try {
      // 1) Upload audio
      const ext = mimeRef.current.includes("mp4") ? "mp4" : mimeRef.current.includes("ogg") ? "ogg" : "webm";
      const ts = Date.now();
      const safeName = (session?.name || "student").replace(/[^a-z0-9-_]+/gi, "_");
      const path = `${safeName}/${ts}.${ext}`;
      setStatus("uploading");
      console.log("[reading] upload started ->", path);
      const { error: upErr } = await supabase.storage
        .from("reading-audio")
        .upload(path, blob, { contentType: mimeRef.current, upsert: false });
      if (upErr) throw upErr;
      console.log("[reading] upload completed");

      // 2) Analyze
      const fd = new FormData();
      fd.append("audio", blob, `reading.${ext}`);
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
        console.error("[reading] analysis failed", res.status, msg);
        if (errData.fix) {
          toast.error(msg, { description: errData.fix });
        } else {
          toast.error(msg);
        }
        setBusy(false);
        setStatus("idle");
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
      setStatus("done");
      console.log("[reading] AI analysis complete");
      toast.success("Recording analyzed");
    } catch (e: any) {
      console.error("[reading] submit error", e);
      setStatus("idle");
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
          <Link
            to="/student/reading-practice"
            className="text-xs font-medium rounded-lg border border-border px-2.5 py-1.5 hover:bg-secondary"
          >
            Guided ✨
          </Link>
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
            <div className="mt-4 font-mono text-3xl tabular-nums font-semibold">
              {mm}:{ss}
              <span className="text-sm text-muted-foreground font-normal"> / 10:00</span>
            </div>
            <div className="mt-2 w-full max-w-xs h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full transition-all ${recording ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (elapsed / MAX_SEC) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center px-4">
              {busy
                ? "Analyzing your reading…"
                : recording
                ? `Recording… tap to Stop & Submit (auto-stops at 10:00)`
                : "Tap the mic to Start Recording · max 10 minutes"}
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
