import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import {
  Volume2,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Star,
  Trophy,
  FileDown,
  Award,
  RotateCcw,
} from "lucide-react";
import {
  PRAISE,
  RETRY,
  fmtTime,
  gradeOf,
  performanceOf,
  randomOf,
  signPages,
  speak,
  stopSpeaking,
  type Hotspot,
  type VisualPaper,
} from "@/lib/visual-test";
import { downloadCertificatePdf, downloadParentReportPdf } from "@/lib/visual-report";

export const Route = createFileRoute("/student/visual/$id")({
  component: VisualPlayer,
  head: () => ({
    meta: [
      { title: "Fun Worksheet — Vertex Junior Academy" },
      {
        name: "description",
        content: "Tap directly on the printed worksheet to answer — voice guided, colourful and fun.",
      },
      { property: "og:title", content: "Fun Worksheet — Vertex Junior Academy" },
      {
        property: "og:description",
        content: "Voice guided digital worksheet for LKG and UKG kids.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SESSION_KEY = "student_session_v2";
type Session = { name: string; student_class: string; roll_number: string };

type Flash = { id: string; ok: boolean } | null;

function VisualPlayer() {
  const { id } = useParams({ from: "/student/visual/$id" });
  const [paper, setPaper] = useState<VisualPaper | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [spots, setSpots] = useState<Hotspot[]>([]);
  const [qi, setQi] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  const [wrongKeys, setWrongKeys] = useState<Record<string, boolean>>({});
  const [doneKeys, setDoneKeys] = useState<Record<string, boolean>>({});
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<Hotspot | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(Date.now());

  const session: Session = useMemo(() => {
    if (typeof window === "undefined") return { name: "Student", student_class: "LKG", roll_number: "" };
    try {
      return { ...JSON.parse(localStorage.getItem(SESSION_KEY) || "{}") } as Session;
    } catch {
      return { name: "Student", student_class: "LKG", roll_number: "" };
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("visual_papers").select("*").eq("id", id).maybeSingle();
      if (!data) return;
      const p = data as unknown as VisualPaper;
      setPaper(p);
      setUrls(await signPages(p.pages || []));
      const { data: hs } = await supabase
        .from("visual_hotspots")
        .select("*")
        .eq("paper_id", id)
        .order("sort_order");
      setSpots(((hs || []) as unknown as Hotspot[]).map((h) => ({ ...h, x: +h.x, y: +h.y, w: +h.w, h: +h.h })));
    })();
    return () => stopSpeaking();
  }, [id]);

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [finished]);

  const questions = paper?.questions || [];
  const q = questions[qi];
  const qSpots = useMemo(() => (q ? spots.filter((s) => s.group_key === q.key) : []), [spots, q]);
  const pageIndex = q?.page_index ?? 0;

  // Auto read the question aloud
  useEffect(() => {
    if (q && !finished) speak(q.prompt);
  }, [q?.key, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMatchQ = qSpots.some((s) => s.kind === "drag");
  const targets = qSpots.filter((s) => s.kind === "target");
  const drags = qSpots.filter((s) => s.kind === "drag");

  const advance = useCallback(() => {
    setTimeout(() => {
      setFlash(null);
      setMatched({});
      if (qi + 1 >= questions.length) finish();
      else setQi((i) => i + 1);
    }, 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, questions.length]);

  function celebrate() {
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, scalar: 0.9 });
    speak(randomOf(PRAISE), { rate: 0.95, pitch: 1.4 });
  }

  function onTap(s: Hotspot) {
    if (!q || finished || doneKeys[q.key]) return;
    if (s.is_correct) {
      setFlash({ id: s.id, ok: true });
      setDoneKeys((p) => ({ ...p, [q.key]: true }));
      celebrate();
      advance();
    } else {
      setFlash({ id: s.id, ok: false });
      setWrongKeys((p) => ({ ...p, [q.key]: true }));
      speak(randomOf(RETRY), { rate: 0.9, pitch: 1.1 });
      setTimeout(() => setFlash(null), 700);
    }
  }

  /* ------------------------- drag & drop (matching) ------------------------- */
  const relPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function move(ev: PointerEvent) {
      setGhost(relPoint(ev));
    }
    function up(ev: PointerEvent) {
      const p = relPoint(ev);
      const hit = targets.find((t) => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
      if (hit && dragging) {
        if (hit.match_key && hit.match_key === dragging.match_key) {
          const next = { ...matched, [dragging.id]: hit.id };
          setMatched(next);
          confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 }, scalar: 0.8 });
          if (Object.keys(next).length >= drags.length && q) {
            setDoneKeys((prev) => ({ ...prev, [q.key]: true }));
            celebrate();
            advance();
          } else {
            speak(randomOf(PRAISE), { rate: 1, pitch: 1.4 });
          }
        } else {
          if (q) setWrongKeys((prev) => ({ ...prev, [q.key]: true }));
          setFlash({ id: hit.id, ok: false });
          speak(randomOf(RETRY), { rate: 0.9, pitch: 1.1 });
          setTimeout(() => setFlash(null), 700);
        }
      }
      setDragging(null);
      setGhost(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, targets, matched, drags.length, q, relPoint, advance]);

  /* --------------------------------- finish -------------------------------- */
  async function finish() {
    stopSpeaking();
    const total = questions.length || 1;
    const wrong = Object.keys(wrongKeys).length;
    const correct = Math.max(0, total - wrong);
    const pct = Math.round((correct / total) * 100);
    const time = Math.round((Date.now() - startedAt.current) / 1000);
    setSeconds(time);
    setFinished(true);
    speak(
      pct >= 70 ? "Wow! You did an amazing job!" : "Good try! Let's practise a little more.",
      { rate: 0.9, pitch: 1.3 },
    );
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });
    const { data } = await supabase
      .from("visual_attempts")
      .insert({
        paper_id: id,
        student_name: session.name || "Student",
        student_class: session.student_class || paper?.student_class || "LKG",
        roll_number: session.roll_number || null,
        answers: { wrong: Object.keys(wrongKeys) } as unknown as never,
        correct_count: correct,
        wrong_count: wrong,
        total_questions: total,
        percentage: pct,
        time_taken_sec: time,
        grade: gradeOf(pct),
      })
      .select("id")
      .maybeSingle();
    if (data) setSavedId(data.id as string);
  }

  if (!paper) {
    return (
      <div className="min-h-screen grid place-items-center bg-amber-50 text-amber-900">Loading worksheet…</div>
    );
  }

  if (paper.status !== "published") {
    return (
      <div className="min-h-screen grid place-items-center bg-amber-50 p-6 text-center">
        <div>
          <div className="text-4xl mb-3">🐣</div>
          <p className="font-semibold text-amber-900">This worksheet is not published yet.</p>
          <Link to="/student" className="text-sm underline mt-2 inline-block">
            Back to my dashboard
          </Link>
        </div>
      </div>
    );
  }

  /* --------------------------------- result -------------------------------- */
  if (finished) {
    const total = questions.length || 1;
    const wrong = Object.keys(wrongKeys).length;
    const correct = Math.max(0, total - wrong);
    const pct = Math.round((correct / total) * 100);
    const weak = Array.from(
      new Set(questions.filter((x) => wrongKeys[x.key]).map((x) => x.topic || x.type)),
    );
    const strong = Array.from(
      new Set(questions.filter((x) => !wrongKeys[x.key]).map((x) => x.topic || x.type)),
    );
    const meta = {
      student_name: session.name || "Student",
      student_class: session.student_class || paper.student_class,
      roll_number: session.roll_number || "",
      paper_title: paper.title,
      subject: paper.subject,
      date: new Date().toLocaleString(),
      correct,
      wrong,
      total,
      percentage: pct,
      time_taken_sec: seconds,
      grade: gradeOf(pct),
      strong,
      weak,
      suggestions: [
        weak.length
          ? `Practise these at home with real objects: ${weak.join(", ")}.`
          : "Keep revising daily for 10 minutes to stay sharp.",
        "Read the picture aloud with your child before they tap the answer.",
        "Praise every correct attempt — confidence builds speed.",
      ],
    };
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 p-4">
        <Toaster richColors />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-lg mx-auto rounded-3xl bg-white shadow-xl p-6 text-center space-y-4 border-4 border-orange-200"
        >
          <div className="text-6xl">{pct >= 70 ? "🏆" : "🌟"}</div>
          <h1 className="font-display text-2xl font-extrabold text-orange-600">
            {performanceOf(pct)}, {meta.student_name}!
          </h1>
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              ["Score", `${pct}%`],
              ["Grade", meta.grade],
              ["Correct", `${correct} / ${total}`],
              ["Time", fmtTime(seconds)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-orange-50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-orange-500 font-semibold">{k}</div>
                <div className="text-xl font-extrabold text-orange-800">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`size-7 ${i < Math.round(pct / 20) ? "fill-yellow-400 text-yellow-400" : "text-orange-200"}`}
              />
            ))}
          </div>
          <div className="grid gap-2">
            <button
              onClick={() => downloadCertificatePdf(meta)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 text-white px-4 py-3 font-bold hover:opacity-90"
            >
              <Award className="size-5" /> Download certificate
            </button>
            <button
              onClick={() => downloadParentReportPdf(meta)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 text-white px-4 py-3 font-bold hover:opacity-90"
            >
              <FileDown className="size-5" /> Parent report (PDF)
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 px-4 py-3 font-bold text-orange-700"
            >
              <RotateCcw className="size-5" /> Try again
            </button>
            <Link
              to="/student"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm text-orange-700"
            >
              Back to dashboard
            </Link>
          </div>
          {savedId && <p className="text-[11px] text-muted-foreground">Result saved for your teacher ✓</p>}
        </motion.div>
      </div>
    );
  }

  /* ---------------------------------- play ---------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-amber-50">
      <Toaster richColors />
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b-4 border-orange-200 px-3 py-2 flex items-center gap-2">
        <Link to="/student" className="p-2 rounded-xl hover:bg-orange-100" aria-label="Back">
          <ArrowLeft className="size-5 text-orange-600" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-display font-extrabold text-orange-700 truncate">{paper.title}</div>
          <div className="text-[11px] text-orange-500">
            Question {Math.min(qi + 1, questions.length)} of {questions.length} · {fmtTime(seconds)}
          </div>
        </div>
        <button onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="p-2 rounded-xl hover:bg-orange-100" aria-label="Zoom out">
          <ZoomOut className="size-5 text-orange-600" />
        </button>
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-2 rounded-xl hover:bg-orange-100" aria-label="Zoom in">
          <ZoomIn className="size-5 text-orange-600" />
        </button>
        <button
          onClick={() => finish()}
          className="rounded-xl bg-emerald-500 text-white px-3 py-2 text-xs font-bold"
        >
          <Trophy className="size-4 inline mr-1" /> Finish
        </button>
      </header>

      {q && (
        <div className="px-3 py-3">
          <motion.button
            key={q.key}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => speak(q.prompt)}
            className="w-full rounded-3xl bg-white border-4 border-orange-200 shadow px-4 py-3 flex items-center gap-3 text-left"
          >
            <span className="grid place-items-center size-11 rounded-full bg-orange-500 text-white shrink-0">
              <Volume2 className="size-6" />
            </span>
            <span className="font-display text-lg font-bold text-orange-800 leading-snug">{q.prompt}</span>
          </motion.button>
        </div>
      )}

      <div className="px-2 pb-24 overflow-auto">
        <div
          ref={wrapRef}
          className="relative mx-auto touch-pan-y select-none origin-top"
          style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 900 : undefined }}
          onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
        >
          {urls[pageIndex] ? (
            <img
              src={urls[pageIndex]}
              alt={`${paper.title} — page ${pageIndex + 1}`}
              className="w-full block rounded-2xl shadow"
              draggable={false}
            />
          ) : (
            <div className="h-64 grid place-items-center text-sm text-orange-500">Loading page…</div>
          )}

          {qSpots.map((s) => {
            const isFlash = flash?.id === s.id;
            const isMatchedDrag = !!matched[s.id];
            const isUsedTarget = Object.values(matched).includes(s.id);
            return (
              <motion.div
                key={s.id}
                animate={isFlash && !flash?.ok ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                onPointerDown={(e) => {
                  if (s.kind === "drag" && !isMatchedDrag) {
                    e.preventDefault();
                    setDragging(s);
                    setGhost(relPoint(e));
                  }
                }}
                onClick={() => s.kind === "tap" && onTap(s)}
                role={s.kind === "tap" ? "button" : undefined}
                aria-label={s.label || "answer area"}
                className={`absolute rounded-xl transition-colors cursor-pointer border-4 ${
                  isFlash
                    ? flash?.ok
                      ? "border-emerald-500 bg-emerald-400/25"
                      : "border-red-500 bg-red-400/25"
                    : isMatchedDrag || isUsedTarget
                      ? "border-emerald-400 bg-emerald-300/20"
                      : "border-transparent hover:border-sky-400/70 hover:bg-sky-300/15 active:bg-sky-300/25"
                }`}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  width: `${s.w * 100}%`,
                  height: `${s.h * 100}%`,
                  touchAction: s.kind === "drag" ? "none" : undefined,
                }}
              >
                <AnimatePresence>
                  {isFlash && flash?.ok && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-3 -right-3 grid place-items-center size-8 rounded-full bg-emerald-500 text-white text-lg shadow"
                    >
                      ✓
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {dragging && ghost && (
            <div
              className="pointer-events-none absolute rounded-xl border-4 border-sky-500 bg-sky-300/40"
              style={{
                left: `${(ghost.x - dragging.w / 2) * 100}%`,
                top: `${(ghost.y - dragging.h / 2) * 100}%`,
                width: `${dragging.w * 100}%`,
                height: `${dragging.h * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t-4 border-orange-200 px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => {
            setQi((i) => Math.max(0, i - 1));
            setFlash(null);
            setMatched({});
          }}
          disabled={qi === 0}
          className="rounded-2xl border-2 border-orange-200 px-4 py-2 text-sm font-bold text-orange-700 disabled:opacity-40"
        >
          ◀ Back
        </button>
        <div className="flex-1 h-3 rounded-full bg-orange-100 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${questions.length ? ((qi + 1) / questions.length) * 100 : 0}%` }}
          />
        </div>
        <button
          onClick={() => {
            setFlash(null);
            setMatched({});
            if (qi + 1 >= questions.length) finish();
            else setQi((i) => i + 1);
          }}
          className="rounded-2xl bg-orange-500 text-white px-4 py-2 text-sm font-bold"
        >
          {qi + 1 >= questions.length ? "Finish" : "Next ▶"}
        </button>
      </div>

      {isMatchQ && (
        <div className="fixed bottom-16 inset-x-0 text-center text-[11px] text-orange-600 pointer-events-none">
          Drag the picture onto the matching box — it snaps automatically.
        </div>
      )}
    </div>
  );
}
