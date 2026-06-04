import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  Pencil,
  Eye,
  Download,
  Upload,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import jsPDF from "jspdf";

export const Route = createFileRoute("/teacher/materials")({
  component: MaterialsPage,
});

type Material = {
  id: string;
  student_class: string;
  subject: string;
  chapter: string;
  title: string;
  description: string | null;
  teacher_name: string | null;
  file_url: string;
  file_path: string | null;
  file_type: string;
  file_size_bytes: number | null;
  source: string;
  created_at: string;
};

const CLASSES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const SUBJECTS = ["Maths", "English", "Science", "Hindi", "SST", "Computer", "Sanskrit", "Other"];
const BUCKET = "study-materials";

const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*";

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "bin";
}

function typeLabel(t: string) {
  const x = t.toLowerCase();
  if (x.includes("pdf")) return "PDF";
  if (x.includes("image") || ["png", "jpg", "jpeg", "webp", "gif"].includes(x)) return "Image";
  if (x.includes("word") || x === "doc" || x === "docx") return "Word";
  if (x.includes("presentation") || x === "ppt" || x === "pptx") return "PPT";
  return x.toUpperCase();
}

function IconFor({ t }: { t: string }) {
  const l = typeLabel(t);
  if (l === "Image") return <ImageIcon className="size-4" />;
  if (l === "PDF") return <FileText className="size-4" />;
  return <FileIcon className="size-4" />;
}

async function openSignedUrl(path: string, download = false) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60, download ? { download: true } : undefined);
  if (error || !data?.signedUrl) {
    toast.error(error?.message || "Could not open file");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

function MaterialsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["study_materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_materials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Material[];
    },
  });

  const filtered = useMemo(
    () =>
      materials.filter(
        (m) =>
          (filterClass === "all" || m.student_class === filterClass) &&
          (filterSubject === "all" || m.subject === filterSubject),
      ),
    [materials, filterClass, filterSubject],
  );

  // Group by class -> subject -> chapter
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Record<string, Material[]>>> = {};
    for (const m of filtered) {
      g[m.student_class] ??= {};
      g[m.student_class][m.subject] ??= {};
      g[m.student_class][m.subject][m.chapter] ??= [];
      g[m.student_class][m.subject][m.chapter].push(m);
    }
    return g;
  }, [filtered]);

  async function remove(m: Material) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    if (m.file_path) {
      await supabase.storage.from(BUCKET).remove([m.file_path]);
    }
    const { error } = await supabase.from("study_materials").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["study_materials"] });
  }

  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="size-6" /> Study Materials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload notes, PDFs, slides for each class. Students see only their class.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus className="size-4" /> Add material
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All classes</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <BookOpen className="size-10 mx-auto text-muted-foreground" />
          <p className="font-display text-lg mt-3">No materials yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Add material" to upload your first PDF, notes or slides.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cls, subjects]) => (
            <section key={cls} className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <h2 className="font-display text-lg font-semibold">{cls}</h2>
              <div className="mt-3 space-y-4">
                {Object.entries(subjects).map(([sub, chapters]) => (
                  <div key={sub}>
                    <div className="text-sm font-semibold text-primary">{sub}</div>
                    <div className="mt-2 space-y-3">
                      {Object.entries(chapters).map(([chap, items]) => (
                        <div key={chap}>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">
                            {chap}
                          </div>
                          <ul className="mt-1.5 space-y-1.5">
                            {items.map((m) => (
                              <li
                                key={m.id}
                                className="rounded-lg border border-border bg-background p-3 flex items-center gap-3"
                              >
                                <div className="size-9 rounded-md bg-secondary grid place-items-center text-secondary-foreground">
                                  <IconFor t={m.file_type} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{m.title}</div>
                                  {m.description && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {m.description}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {typeLabel(m.file_type)}
                                    {m.teacher_name ? ` · ${m.teacher_name}` : ""} ·{" "}
                                    {new Date(m.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    title="View"
                                    onClick={() => m.file_path && openSignedUrl(m.file_path)}
                                    className="p-1.5 rounded-md hover:bg-secondary"
                                  >
                                    <Eye className="size-4" />
                                  </button>
                                  <button
                                    title="Download"
                                    onClick={() => m.file_path && openSignedUrl(m.file_path, true)}
                                    className="p-1.5 rounded-md hover:bg-secondary"
                                  >
                                    <Download className="size-4" />
                                  </button>
                                  <button
                                    title="Edit"
                                    onClick={() => {
                                      setEditing(m);
                                      setOpen(true);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-secondary"
                                  >
                                    <Pencil className="size-4" />
                                  </button>
                                  <button
                                    title="Delete"
                                    onClick={() => remove(m)}
                                    className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <MaterialDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}

function MaterialDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Material | null;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"upload" | "generate">("upload");
  const [studentClass, setStudentClass] = useState(CLASSES[0]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [chapter, setChapter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [coachingName, setCoachingName] = useState("Vertex Junior Academy");
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMode("upload");
      setStudentClass(editing.student_class);
      setSubject(editing.subject);
      setChapter(editing.chapter);
      setTitle(editing.title);
      setDescription(editing.description || "");
      setTeacherName(editing.teacher_name || "");
      setFile(null);
      setContent("");
    } else {
      setMode("upload");
      setStudentClass(CLASSES[0]);
      setSubject(SUBJECTS[0]);
      setChapter("");
      setTitle("");
      setDescription("");
      setTeacherName("");
      setFile(null);
      setContent("");
    }
    setProgress(0);
  }, [open, editing]);

  function buildPdf(): Blob {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 18;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(coachingName || "Vertex Junior Academy", w / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${studentClass} · ${subject}`, w / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Chapter: ${chapter}`, w / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(13);
    doc.text(title, w / 2, y, { align: "center" });
    y += 4;
    if (teacherName) {
      y += 4;
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(`By ${teacherName}`, w / 2, y, { align: "center" });
    }
    y += 4;
    doc.setDrawColor(180);
    doc.line(margin, y, w - margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        y += 4;
        continue;
      }
      // Heading: starts with #
      const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
      const bullet = /^\s*[-*•]\s+/.test(line);
      let text = line;
      let size = 11;
      let bold = false;
      let indent = 0;
      if (hMatch) {
        size = hMatch[1].length === 1 ? 14 : hMatch[1].length === 2 ? 13 : 12;
        bold = true;
        text = hMatch[2];
      } else if (bullet) {
        text = "• " + line.replace(/^\s*[-*•]\s+/, "");
        indent = 4;
      }
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const wrapped = doc.splitTextToSize(text, w - margin * 2 - indent);
      for (const wl of wrapped) {
        if (y > 280) {
          doc.addPage();
          y = 18;
        }
        doc.text(wl, margin + indent, y);
        y += size * 0.5 + 2;
      }
      y += 1;
    }
    return doc.output("blob");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chapter.trim()) return toast.error("Enter chapter / topic");
    if (!title.trim()) return toast.error("Enter title");

    setBusy(true);
    setProgress(5);
    try {
      let file_url = editing?.file_url || "";
      let file_path = editing?.file_path || "";
      let file_type = editing?.file_type || "";
      let file_size_bytes = editing?.file_size_bytes || 0;
      let source = editing?.source || "upload";

      let uploadBlob: Blob | null = null;
      let uploadName = "";
      let detectedType = "";

      if (mode === "generate") {
        if (!content.trim()) {
          setBusy(false);
          return toast.error("Type some content for the PDF");
        }
        uploadBlob = buildPdf();
        uploadName = `${title.replace(/\s+/g, "_")}.pdf`;
        detectedType = "pdf";
        source = "generated";
      } else if (file) {
        uploadBlob = file;
        uploadName = file.name;
        detectedType = extOf(file.name);
        source = "upload";
      }

      if (uploadBlob) {
        setProgress(25);
        const path = `${studentClass.replace(/\s+/g, "_")}/${subject}/${Date.now()}_${uploadName}`;
        // animate progress while upload runs
        let p = 25;
        const tick = setInterval(() => {
          p = Math.min(p + 6, 85);
          setProgress(p);
        }, 200);
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, uploadBlob, {
            upsert: false,
            contentType: uploadBlob.type || undefined,
          });
        clearInterval(tick);
        if (upErr) {
          setBusy(false);
          setProgress(0);
          return toast.error(upErr.message);
        }
        setProgress(92);
        // delete previous file when replacing
        if (editing?.file_path) {
          await supabase.storage.from(BUCKET).remove([editing.file_path]);
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        file_path = path;
        file_url = pub.publicUrl;
        file_type = detectedType;
        file_size_bytes = uploadBlob.size;
      } else if (!editing) {
        setBusy(false);
        return toast.error("Choose a file or generate from text");
      }

      const payload = {
        student_class: studentClass,
        subject,
        chapter: chapter.trim(),
        title: title.trim(),
        description: description.trim() || null,
        teacher_name: teacherName.trim() || null,
        file_url,
        file_path,
        file_type,
        file_size_bytes,
        source,
      };

      if (editing) {
        const { error } = await supabase
          .from("study_materials")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from("study_materials").insert(payload);
        if (error) throw error;
        toast.success("Material added");
      }
      setProgress(100);
      qc.invalidateQueries({ queryKey: ["study_materials"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit material" : "Add study material"}</DialogTitle>
        </DialogHeader>

        {!editing && (
          <div className="flex gap-2 -mt-2">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                mode === "upload" ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              <Upload className="size-4" /> Upload file
            </button>
            <button
              type="button"
              onClick={() => setMode("generate")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                mode === "generate" ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              <Sparkles className="size-4" /> Type → PDF
            </button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Class</label>
              <select
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Chapter / Topic</label>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Chapter 5: Light"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reflection of light — notes"
              maxLength={160}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note for students"
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Teacher name (optional)</label>
              <input
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {mode === "generate" && (
              <div>
                <label className="text-xs font-medium">Institute name</label>
                <input
                  value={coachingName}
                  onChange={(e) => setCoachingName(e.target.value)}
                  maxLength={80}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {mode === "upload" ? (
            <div>
              <label className="text-xs font-medium">
                File {editing ? "(leave empty to keep existing)" : "(PDF / Word / PPT / Image)"}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-secondary file:text-secondary-foreground file:px-2 file:py-1 file:text-xs"
              />
              {editing && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  Current: {typeLabel(editing.file_type)} · {(editing.file_size_bytes || 0) > 0
                    ? `${Math.round((editing.file_size_bytes || 0) / 1024)} KB`
                    : ""}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium">
                Content (use # for headings, - for bullets)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`# Introduction\nLight is a form of energy...\n\n## Key points\n- Travels in a straight line\n- Reflects off mirrors`}
                rows={10}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {busy && (
            <div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Uploading… {progress}%</div>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Upload"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
