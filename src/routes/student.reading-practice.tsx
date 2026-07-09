import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Mic,
  Square,
  Loader2,
  Volume2,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/student/reading-practice")({
  component: Page,
  head: () => ({
    meta: [{ title: "Guided reading practice — Vertex Junior Academy" }],
  }),
});

const SAMPLE_EN = `The little rabbit lived near a big tree. Every morning he ate fresh carrots and drank cool water from the pond. One day he found a shiny red ball under the tree and played with his friends all afternoon.`;
const SAMPLE_HI = `छोटा खरगोश एक बड़े पेड़ के पास रहता था। हर सुबह वह ताज़ी गाजर खाता और तालाब से ठंडा पानी पीता था। एक दिन उसे पेड़ के नीचे एक चमकती हुई लाल गेंद मिली।`;

type WordStatus = "pending" | "correct" | "wrong";
type Token = { raw: string; norm: string; isWord: boolean };
type MCQ = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};
type Meaning = {
  hindi_meaning: string;
  definition: string;
  example: string;
  part_of_speech?: string;
};

function normalize(w: string, lang: "en" | "hi") {
  if (lang === "hi") {
    return w
      .replace(/[।,.!?;:"'()\[\]{}"'—–-]/g, "")
      .replace(/\s+/g, "")
      .trim();
  }
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9']/g, "")
    .trim();
}

function tokenize(passage: string, lang: "en" | "hi"): Token[] {
  // Split preserving whitespace/punct
  const parts = passage.match(/\S+|\s+/g) || [];
  const out: Token[] = [];
  for (const p of parts) {
    if (/^\s+$/.test(p)) {
      out.push({ raw: p, norm: "", isWord: false });
      continue;
    }
    const norm = normalize(p, lang);
    out.push({ raw: p, norm, isWord: norm.length > 0 });
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[a.length];
}

function fuzzyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const len = Math.max(a.length, b.length);
  if (len <= 3) return a === b;
  const tol = len >= 7 ? 2 : 1;
  return levenshtein(a, b) <= tol;
}

function alignWords(
  expected: Token[],
  spokenNorms: string[]
): WordStatus[] {
  const statuses: WordStatus[] = expected.map(() =>
    "pending" as WordStatus
  );
  let j = 0;
  for (let i = 0; i < expected.length; i++) {
    const tok = expected[i];
    if (!tok.isWord) continue;
    if (j >= spokenNorms.length) {
      statuses[i] = "pending";
      continue;
    }
    // Look ahead a few tokens in transcript for a match
    let matchedAt = -1;
    for (let k = j; k < Math.min(spokenNorms.length, j + 4); k++) {
      if (fuzzyEqual(tok.norm, spokenNorms[k])) {
        matchedAt = k;
        break;
      }
    }
    if (matchedAt >= 0) {
      statuses[i] = "correct";
      j = matchedAt + 1;
    } else {
      statuses[i] = "wrong";
      // don't advance j, transcript may catch up next word
    }
  }
  return statuses;
}

function Page() {
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [passage, setPassage] = useState(SAMPLE_EN);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [statuses, setStatuses] = useState<WordStatus[]>([]);
  const [quiz, setQuiz] = useState<MCQ[] | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [popup, setPopup] = useState<
    | { word: string; loading: boolean; data?: Meaning; error?: string }
    | null
  >(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const tokens = useMemo(() => tokenize(passage, language), [passage, language]);

  function loadSample(lang: "en" | "hi") {
    setLanguage(lang);
    setPassage(lang === "hi" ? SAMPLE_HI : SAMPLE_EN);
    reset();
  }

  function reset() {
    setStatuses([]);
    setTranscript("");
    setQuiz(null);
    setAnswers({});
  }

  async function start() {
    if (!passage.trim()) return toast.error("Passage add karo");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Mic not available");
    }
  }

  async function stopAndAnalyze() {
    if (!mediaRef.current) return;
    setBusy(true);
    setRecording(false);
    const blob: Blob = await new Promise((resolve) => {
      mediaRef.current!.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRef.current!.stream.getTracks().forEach((t) => t.stop());
        resolve(b);
      };
      mediaRef.current!.stop();
    });

    try {
      const fd = new FormData();
      fd.append("audio", blob, "read.webm");
      fd.append("language", language);
      const res = await fetch("/api/public/sarvam-stt", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "STT failed");
      const t = (data.transcript || "").trim();
      setTranscript(t);

      const spokenNorms = t
        .split(/\s+/)
        .map((w) => normalize(w, language))
        .filter(Boolean);
      const st = alignWords(tokens, spokenNorms);
      setStatuses(st);

      const total = tokens.filter((x) => x.isWord).length;
      const correct = st.filter((s) => s === "correct").length;
      toast.success(`${correct} / ${total} words correct`);
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadQuiz() {
    setQuizLoading(true);
    try {
      const res = await fetch("/api/public/reading-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage, language, count: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quiz failed");
      setQuiz(data.questions);
      setAnswers({});
    } catch (e: any) {
      toast.error(e?.message || "Quiz generation failed");
    } finally {
      setQuizLoading(false);
    }
  }

  function speakWord(word: string) {
    try {
      const clean = word.replace(/[।,.!?;:"'()\[\]{}"'—–-]/g, "").trim();
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = language === "hi" ? "hi-IN" : "en-US";
      u.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  async function openMeaning(word: string) {
    const clean = word.replace(/[।,.!?;:"'()\[\]{}"'—–-]/g, "").trim();
    if (!clean) return;
    setPopup({ word: clean, loading: true });
    try {
      const res = await fetch("/api/public/word-meaning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: clean,
          context: passage.slice(0, 400),
          source_language: language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPopup({ word: clean, loading: false, data });
    } catch (e: any) {
      setPopup({ word: clean, loading: false, error: e?.message || "Failed" });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-5 py-3 flex items-center justify-between">
          <Link
            to="/student"
            className="inline-flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="font-display font-semibold flex items-center gap-2">
            <BookOpen className="size-5 text-primary" /> Guided reading
          </div>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6 space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="font-display text-lg font-semibold">
              Read this passage aloud
            </h1>
            <div className="flex gap-2">
              {(["en", "hi"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => loadSample(l)}
                  disabled={recording || busy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    language === l
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  {l === "en" ? "English" : "हिंदी"}
                </button>
              ))}
            </div>
          </div>

          {statuses.length === 0 ? (
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              disabled={recording || busy}
              rows={6}
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-base leading-relaxed"
              placeholder="Passage paste karo…"
            />
          ) : (
            <div className="mt-3 rounded-lg border border-border bg-background px-4 py-3 text-base leading-loose">
              {tokens.map((tok, i) => {
                if (!tok.isWord) return <span key={i}>{tok.raw}</span>;
                const st = statuses[i];
                const color =
                  st === "correct"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : st === "wrong"
                    ? "text-red-600 dark:text-red-400 underline decoration-wavy underline-offset-4"
                    : "text-muted-foreground";
                return (
                  <span
                    key={i}
                    onClick={() => {
                      if (st === "wrong") speakWord(tok.raw);
                      openMeaning(tok.raw);
                    }}
                    className={`${color} cursor-pointer hover:bg-secondary/60 rounded px-0.5`}
                    title={
                      st === "wrong"
                        ? "Sahi uchcharan sunne ke liye click karo"
                        : "Meaning ke liye click karo"
                    }
                  >
                    {tok.raw}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={recording ? stopAndAnalyze : start}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-white shadow-lg ${
                recording
                  ? "bg-red-600 animate-pulse"
                  : "bg-gradient-to-br from-primary to-primary/70"
              } disabled:opacity-60`}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Analyzing…
                </>
              ) : recording ? (
                <>
                  <Square className="size-4" /> Stop & check
                </>
              ) : (
                <>
                  <Mic className="size-4" /> Start reading
                </>
              )}
            </button>

            {statuses.length > 0 && (
              <>
                <button
                  onClick={reset}
                  disabled={busy || recording}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <RotateCcw className="size-4" /> Try again
                </button>
                <button
                  onClick={loadQuiz}
                  disabled={quizLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  {quizLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4 text-primary" />
                  )}
                  Comprehension quiz
                </button>
              </>
            )}
          </div>

          {statuses.length > 0 && (
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Correct{" "}
                {statuses.filter((s) => s === "correct").length}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-red-500" /> Mispronounced{" "}
                {statuses.filter((s) => s === "wrong").length}
              </span>
              <span>
                Red word par click → sahi uchcharan · Kisi bhi word par click → meaning
              </span>
            </div>
          )}

          {transcript && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Aapne kya bola (transcript)
              </summary>
              <p className="mt-1 text-sm text-muted-foreground italic">
                "{transcript}"
              </p>
            </details>
          )}
        </div>

        {quiz && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Quick comprehension
            </h2>
            <div className="mt-4 space-y-5">
              {quiz.map((q, qi) => {
                const picked = answers[qi];
                const answered = picked !== undefined;
                return (
                  <div key={qi}>
                    <div className="font-medium">
                      {qi + 1}. {q.question}
                    </div>
                    <div className="mt-2 grid gap-2">
                      {q.options.map((opt, oi) => {
                        const isCorrect = oi === q.answer_index;
                        const isPicked = picked === oi;
                        let cls =
                          "border-border bg-background hover:bg-secondary/60";
                        if (answered) {
                          if (isCorrect)
                            cls =
                              "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
                          else if (isPicked)
                            cls =
                              "border-red-500 bg-red-500/10 text-red-800 dark:text-red-300";
                          else cls = "border-border bg-background opacity-70";
                        }
                        return (
                          <button
                            key={oi}
                            disabled={answered}
                            onClick={() =>
                              setAnswers((a) => ({ ...a, [qi]: oi }))
                            }
                            className={`text-left rounded-lg border px-3 py-2 text-sm inline-flex items-start gap-2 ${cls}`}
                          >
                            {answered && isCorrect && (
                              <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                            )}
                            {answered && isPicked && !isCorrect && (
                              <XCircle className="size-4 mt-0.5 shrink-0" />
                            )}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {answered && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {popup && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4"
          onClick={() => setPopup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-lg font-semibold">
                {popup.word}
              </div>
              <button
                onClick={() => speakWord(popup.word)}
                className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2 py-1 hover:bg-secondary"
              >
                <Volume2 className="size-3.5" /> Suno
              </button>
            </div>
            {popup.loading ? (
              <div className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Meaning laa rahe hain…
              </div>
            ) : popup.error ? (
              <div className="mt-4 text-sm text-red-600">{popup.error}</div>
            ) : popup.data ? (
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    हिंदी अर्थ
                  </span>
                  <div className="font-medium">{popup.data.hindi_meaning}</div>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    परिभाषा
                  </span>
                  <div>{popup.data.definition}</div>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    उदाहरण
                  </span>
                  <div className="italic text-muted-foreground">
                    {popup.data.example}
                  </div>
                </div>
                {popup.data.part_of_speech && (
                  <div className="text-xs text-muted-foreground">
                    ({popup.data.part_of_speech})
                  </div>
                )}
              </div>
            ) : null}
            <button
              onClick={() => setPopup(null)}
              className="mt-4 w-full rounded-lg border border-border py-2 text-sm hover:bg-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
