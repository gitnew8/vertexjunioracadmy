import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  Sparkles,
  Trash2,
  Pencil,
  Rocket,
  FileImage,
  Loader2,
  EyeOff,
  Eye,
} from "lucide-react";
import { VISUAL_BUCKET, type VisualPaper, type VisualPage } from "@/lib/visual-test";

export const Route = createFileRoute("/teacher/visual/")({
  component: VisualTestsPage,
  head: () => ({
    meta: [
      { title: "Visual Tests — Admin" },
      { name: "description", content: "Upload LKG/UKG worksheets and auto-generate tappable hotspots." },
    ],
  }),
});

const CLASSES = ["LKG", "UKG", "Nursery", "Class 1", "Class 2"];

/** Render a PDF/image file into PNG page blobs using pdfjs. */
async function fileToPages(file: File): Promise<{ blob: Blob; width: number; height: number }[]> {
  if (file.type.startsWith("image/")) {
    const bmp = await createImageBitmap(file);
    return [{ blob: file, width: bmp.width, height: bmp.height }];
  }
  const pdfjsLib = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker as string;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: { blob: Blob; width: number; height: number }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png", 0.92));
    out.push({ blob, width: canvas.width, height: canvas.height });
  }
  return out;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function VisualTestsPage() {
  const [papers, setPapers] = useState<VisualPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [studentClass, setStudentClass] = useState("LKG");
  const [subject, setSubject] = useState("General");
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("visual_papers")
      .select("*")
      .order("created_at", { ascending: false });
    setPapers((data || []) as unknown as VisualPaper[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(file: File) {
    if (!title.trim()) {
      toast.error("Please add a worksheet title first.");
      return;
    }
    try {
      setBusy("Reading pages…");
      const rendered = await fileToPages(file);
      if (!rendered.length) throw new Error("No pages found");

      const paperId = crypto.randomUUID();
      const pages: VisualPage[] = [];
      for (let i = 0; i < rendered.length; i++) {
        setBusy(`Uploading page ${i + 1} of ${rendered.length}…`);
        const path = `${paperId}/page-${i + 1}.png`;
        const { error } = await supabase.storage
          .from(VISUAL_BUCKET)
          .upload(path, rendered[i].blob, { contentType: "image/png", upsert: true });
        if (error) throw error;
        pages.push({ path, width: rendered[i].width, height: rendered[i].height });
      }

      const { error: insErr } = await supabase.from("visual_papers").insert({
        id: paperId,
        title: title.trim(),
        student_class: studentClass,
        subject,
        pages: pages as unknown as never,
        questions: [] as unknown as never,
        status: "draft",
      });
      if (insErr) throw insErr;

      // AI analysis per page
      const allQuestions: Record<string, unknown>[] = [];
      for (let i = 0; i < rendered.length; i++) {
        setBusy(`AI analysing page ${i + 1} of ${rendered.length}…`);
        const dataUrl = await blobToDataUrl(rendered[i].blob);
        const res = await fetch("/api/public/analyze-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, student_class: studentClass, page_index: i }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || `Page ${i + 1} analysis failed`);
          continue;
        }
        const prefix = `p${i + 1}`;
        for (const q of json.questions || []) {
          allQuestions.push({ ...q, key: `${prefix}_${q.key}`, page_index: i });
        }
        const rows = (json.hotspots || []).map((h: Record<string, unknown>, idx: number) => ({
          paper_id: paperId,
          page_index: i,
          group_key: `${prefix}_${h.group_key}`,
          kind: h.kind,
          label: h.label,
          x: h.x,
          y: h.y,
          w: h.w,
          h: h.h,
          is_correct: h.is_correct,
          match_key: h.match_key ?? null,
          sort_order: idx,
        }));
        if (rows.length) await supabase.from("visual_hotspots").insert(rows);
      }

      await supabase
        .from("visual_papers")
        .update({ questions: allQuestions as unknown as never })
        .eq("id", paperId);

      toast.success(`Analysed ${rendered.length} page(s) · ${allQuestions.length} questions found`);
      setTitle("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function togglePublish(p: VisualPaper) {
    const next = p.status === "published" ? "draft" : "published";
    await supabase.from("visual_papers").update({ status: next }).eq("id", p.id);
    toast.success(next === "published" ? "Published for students 🎉" : "Unpublished");
    load();
  }

  async function remove(p: VisualPaper) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await supabase.storage.from(VISUAL_BUCKET).remove((p.pages || []).map((x) => x.path));
    await supabase.from("visual_papers").delete().eq("id", p.id);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Sparkles className="size-6 text-primary" /> Visual Tests (LKG / UKG)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload the original question paper — AI detects questions and creates invisible tappable
          hotspots. The paper itself is never changed.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Worksheet title (e.g. Count & Match)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
        <button
          disabled={!!busy}
          onClick={() => fileRef.current?.click()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy || "Upload PDF / JPG / PNG and auto-detect"}
        </button>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && !papers.length && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No visual papers yet. Upload your first worksheet above.
          </div>
        )}
        {papers.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3"
          >
            <FileImage className="size-8 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{p.title}</div>
              <div className="text-xs text-muted-foreground">
                {p.student_class} · {p.subject} · {(p.pages || []).length} page(s) ·{" "}
                {(p.questions || []).length} questions ·{" "}
                <span className={p.status === "published" ? "text-emerald-600" : "text-amber-600"}>
                  {p.status}
                </span>
              </div>
            </div>
            <Link
              to="/teacher/visual/$id"
              params={{ id: p.id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
            >
              <Pencil className="size-3.5" /> Edit hotspots
            </Link>
            <button
              onClick={() => togglePublish(p)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-semibold hover:opacity-90"
            >
              {p.status === "published" ? <EyeOff className="size-3.5" /> : <Rocket className="size-3.5" />}
              {p.status === "published" ? "Unpublish" : "Publish"}
            </button>
            <Link
              to="/student/visual/$id"
              params={{ id: p.id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
            >
              <Eye className="size-3.5" /> Preview
            </Link>
            <button
              onClick={() => remove(p)}
              className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
              aria-label="Delete"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
