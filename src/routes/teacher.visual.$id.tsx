import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Plus,
  Save,
  Trash2,
  Volume2,
  CheckCircle2,
  Rocket,
  MousePointerClick,
} from "lucide-react";
import {
  QUESTION_TYPES,
  signPages,
  speak,
  type Hotspot,
  type VisualPaper,
  type VisualQuestion,
} from "@/lib/visual-test";

export const Route = createFileRoute("/teacher/visual/$id")({
  component: HotspotEditor,
  head: () => ({
    meta: [
      { title: "Hotspot Editor — Visual Test" },
      { name: "description", content: "Move, resize and verify AI-detected hotspots before publishing." },
    ],
  }),
});

type Drag =
  | { mode: "move"; id: string; dx: number; dy: number }
  | { mode: "resize"; id: string }
  | null;

function HotspotEditor() {
  const { id } = useParams({ from: "/teacher/visual/$id" });
  const [paper, setPaper] = useState<VisualPaper | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [spots, setSpots] = useState<Hotspot[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<Drag>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
  }, [id]);

  const pageSpots = useMemo(() => spots.filter((s) => s.page_index === page), [spots, page]);
  const sel = spots.find((s) => s.id === selected) || null;
  const questions = paper?.questions || [];
  const groupKeys = useMemo(
    () => Array.from(new Set([...questions.map((q) => q.key), ...spots.map((s) => s.group_key)])),
    [questions, spots],
  );

  const rel = useCallback((e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }, []);

  useEffect(() => {
    function onMove(ev: PointerEvent) {
      const d = dragRef.current;
      if (!d || !wrapRef.current) return;
      const { x, y } = rel(ev);
      setSpots((prev) =>
        prev.map((s) => {
          if (s.id !== d.id) return s;
          if (d.mode === "move") {
            return {
              ...s,
              x: Math.max(0, Math.min(1 - s.w, x - d.dx)),
              y: Math.max(0, Math.min(1 - s.h, y - d.dy)),
            };
          }
          return {
            ...s,
            w: Math.max(0.02, Math.min(1 - s.x, x - s.x)),
            h: Math.max(0.02, Math.min(1 - s.y, y - s.y)),
          };
        }),
      );
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [rel]);

  function patch(hid: string, p: Partial<Hotspot>) {
    setSpots((prev) => prev.map((s) => (s.id === hid ? { ...s, ...p } : s)));
  }

  function addSpot() {
    const gk = groupKeys[0] || "p1_q1";
    const nu: Hotspot = {
      id: crypto.randomUUID(),
      paper_id: id,
      page_index: page,
      group_key: gk,
      kind: "tap",
      label: "New hotspot",
      x: 0.4,
      y: 0.4,
      w: 0.14,
      h: 0.1,
      is_correct: false,
      match_key: null,
      sort_order: spots.length,
    };
    setSpots((p) => [...p, nu]);
    setSelected(nu.id);
  }

  function duplicate() {
    if (!sel) return;
    const nu: Hotspot = {
      ...sel,
      id: crypto.randomUUID(),
      x: Math.min(0.9, sel.x + 0.03),
      y: Math.min(0.9, sel.y + 0.03),
    };
    setSpots((p) => [...p, nu]);
    setSelected(nu.id);
  }

  function removeSpot() {
    if (!sel) return;
    setSpots((p) => p.filter((s) => s.id !== sel.id));
    setSelected(null);
  }

  function patchQuestion(key: string, p: Partial<VisualQuestion>) {
    if (!paper) return;
    setPaper({
      ...paper,
      questions: paper.questions.map((q) => (q.key === key ? { ...q, ...p } : q)),
    });
  }

  async function saveAll(publish = false) {
    if (!paper) return;
    setSaving(true);
    try {
      await supabase.from("visual_hotspots").delete().eq("paper_id", id);
      if (spots.length) {
        await supabase.from("visual_hotspots").insert(
          spots.map((s, i) => ({
            paper_id: id,
            page_index: s.page_index,
            group_key: s.group_key,
            kind: s.kind,
            label: s.label,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            is_correct: s.is_correct,
            match_key: s.match_key,
            sort_order: i,
          })),
        );
      }
      await supabase
        .from("visual_papers")
        .update({
          questions: paper.questions as unknown as never,
          instructions: paper.instructions,
          ...(publish ? { status: "published" } : {}),
        })
        .eq("id", id);
      if (publish) setPaper({ ...paper, status: "published" });
      toast.success(publish ? "Saved & published 🎉" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!paper) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/teacher/visual" className="p-2 rounded-lg hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold truncate">{paper.title}</h1>
          <div className="text-xs text-muted-foreground">
            {paper.student_class} · {paper.subject} · {spots.length} hotspots
          </div>
        </div>
        <button
          onClick={() => saveAll(false)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
        >
          <Save className="size-3.5" /> Save
        </button>
        <button
          onClick={() => saveAll(true)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-semibold hover:opacity-90"
        >
          <Rocket className="size-3.5" /> Save & Publish
        </button>
      </div>

      {paper.pages.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {paper.pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                i === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
              }`}
            >
              Page {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card p-2 overflow-auto">
          <div ref={wrapRef} className="relative select-none touch-none mx-auto max-w-full">
            {urls[page] ? (
              <img src={urls[page]} alt={`Page ${page + 1} of ${paper.title}`} className="w-full block" draggable={false} />
            ) : (
              <div className="h-64 grid place-items-center text-sm text-muted-foreground">Loading page…</div>
            )}
            {pageSpots.map((s) => (
              <div
                key={s.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSelected(s.id);
                  const { x, y } = rel(e);
                  dragRef.current = { mode: "move", id: s.id, dx: x - s.x, dy: y - s.y };
                }}
                className={`absolute rounded-lg border-2 cursor-move ${
                  s.id === selected
                    ? "border-primary bg-primary/20"
                    : s.kind === "target"
                      ? "border-violet-500 bg-violet-500/10"
                      : s.kind === "drag"
                        ? "border-sky-500 bg-sky-500/10"
                        : s.is_correct
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-amber-500 bg-amber-500/10"
                }`}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  width: `${s.w * 100}%`,
                  height: `${s.h * 100}%`,
                }}
              >
                <span className="absolute -top-5 left-0 text-[10px] font-semibold bg-background/90 px-1 rounded whitespace-nowrap">
                  {s.group_key}
                  {s.is_correct ? " ✓" : ""}
                  {s.match_key ? ` ·${s.match_key}` : ""}
                </span>
                <span
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSelected(s.id);
                    dragRef.current = { mode: "resize", id: s.id };
                  }}
                  className="absolute -right-1.5 -bottom-1.5 size-3.5 rounded-sm bg-primary cursor-se-resize"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Hotspot</div>
              <button
                onClick={addSpot}
                className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>
            {!sel && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MousePointerClick className="size-3.5" /> Tap a box on the paper to edit it.
              </p>
            )}
            {sel && (
              <div className="space-y-2">
                <input
                  value={sel.label ?? ""}
                  onChange={(e) => patch(sel.id, { label: e.target.value })}
                  placeholder="Label (e.g. Number 3)"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sel.group_key}
                    onChange={(e) => patch(sel.id, { group_key: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    {groupKeys.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sel.kind}
                    onChange={(e) => patch(sel.id, { kind: e.target.value as Hotspot["kind"] })}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="tap">Tap answer</option>
                    <option value="drag">Drag object</option>
                    <option value="target">Drop target</option>
                  </select>
                </div>
                {sel.kind === "tap" ? (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={sel.is_correct}
                      onChange={(e) => patch(sel.id, { is_correct: e.target.checked })}
                    />
                    This is the correct answer
                  </label>
                ) : (
                  <input
                    value={sel.match_key ?? ""}
                    onChange={(e) => patch(sel.id, { match_key: e.target.value })}
                    placeholder="Pair key (same on drag + target)"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                )}
                <div className="grid grid-cols-4 gap-1.5">
                  {(["x", "y", "w", "h"] as const).map((k) => (
                    <label key={k} className="text-[10px] text-muted-foreground">
                      {k.toUpperCase()}
                      <input
                        type="number"
                        step="0.01"
                        value={Number(sel[k]).toFixed(3)}
                        onChange={(e) => patch(sel.id, { [k]: Number(e.target.value) } as Partial<Hotspot>)}
                        className="w-full rounded border border-border bg-background px-1 py-1 text-xs"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={duplicate}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-secondary"
                  >
                    <Copy className="size-3.5" /> Duplicate
                  </button>
                  <button
                    onClick={removeSpot}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/40 text-destructive px-2 py-1.5 text-xs hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
            <div className="text-sm font-semibold">Questions & voice</div>
            {!questions.length && (
              <p className="text-xs text-muted-foreground">No questions detected on this paper.</p>
            )}
            {questions
              .filter((q) => q.page_index === page)
              .map((q) => (
                <div key={q.key} className="rounded-xl border border-border p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono bg-secondary rounded px-1.5 py-0.5">{q.key}</span>
                    <select
                      value={q.type}
                      onChange={(e) => patchQuestion(q.key, { type: e.target.value as VisualQuestion["type"] })}
                      className="flex-1 rounded-lg border border-border bg-background px-1.5 py-1 text-[11px]"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => speak(q.prompt)}
                      className="p-1.5 rounded-lg hover:bg-secondary"
                      aria-label="Play voice"
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={q.prompt}
                    onChange={(e) => patchQuestion(q.key, { prompt: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    {spots.filter((s) => s.group_key === q.key).length} hotspots
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
