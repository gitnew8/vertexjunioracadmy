import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurriculum, CUSTOM_CURRICULUM_KEY, type CustomRow } from "@/lib/custom-curriculum";

export const Route = createFileRoute("/teacher/curriculum")({
  head: () => ({
    meta: [
      { title: "Syllabus Manager — Vertex Junior Academy" },
      { name: "description", content: "Add classes, subjects, chapters and topics for tests." },
    ],
  }),
  component: CurriculumPage,
});

const splitTopics = (s: string) =>
  s.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);

function CurriculumPage() {
  const cur = useCurriculum();
  const qc = useQueryClient();
  const [cls, setCls] = useState("Class 1");
  const [newClass, setNewClass] = useState("");
  const [subject, setSubject] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topics, setTopics] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCh, setEditCh] = useState("");
  const [editTopics, setEditTopics] = useState("");

  const activeClass = newClass.trim() || cls;
  const activeSubject = newSubject.trim() || subject;
  const subjects = cur.subjectsFor(activeClass);
  const customRows = useMemo(
    () => cur.rows.filter((r) => r.student_class === activeClass),
    [cur.rows, activeClass],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: CUSTOM_CURRICULUM_KEY });

  async function add() {
    if (!activeClass) return toast.error("Class chunein");
    if (!activeSubject) return toast.error("Subject chunein ya likhein");
    if (!chapter.trim()) return toast.error("Chapter ka naam likhein");
    setSaving(true);
    const { error } = await supabase.from("custom_curriculum").insert({
      student_class: activeClass,
      subject: activeSubject,
      chapter: chapter.trim(),
      topics: splitTopics(topics),
      added_by_type: "admin",
      added_by_name: "Admin",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Chapter jud gaya ✅");
    setChapter("");
    setTopics("");
    setNewClass("");
    setNewSubject("");
    setCls(activeClass);
    setSubject(activeSubject);
    refresh();
  }

  async function remove(r: CustomRow) {
    if (!confirm(`"${r.chapter}" delete karein?`)) return;
    const { error } = await supabase.from("custom_curriculum").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Delete ho gaya");
    refresh();
  }

  async function saveEdit() {
    if (!editId) return;
    const { error } = await supabase
      .from("custom_curriculum")
      .update({ chapter: editCh.trim(), topics: splitTopics(editTopics) })
      .eq("id", editId);
    if (error) return toast.error(error.message);
    setEditId(null);
    toast.success("Update ho gaya");
    refresh();
  }

  const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📚 Syllabus Manager</h1>
        <p className="text-sm text-muted-foreground">
          Nayi class, subject, chapter aur topics jodein — ye turant Test Builder aur Voice AI me aa jayenge.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1">
          <span className="font-medium">Class</span>
          <select className={input} value={cls} onChange={(e) => { setCls(e.target.value); setSubject(""); }}>
            {cur.classes.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className={input} placeholder="+ Nayi class (optional)" value={newClass} onChange={(e) => setNewClass(e.target.value)} />
        </label>
        <label className="text-sm space-y-1">
          <span className="font-medium">Subject</span>
          <select className={input} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">— chunein —</option>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input className={input} placeholder="+ Naya subject (optional)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
        </label>
        <label className="text-sm space-y-1">
          <span className="font-medium">Chapter</span>
          <input className={input} placeholder="e.g. Fractions" value={chapter} onChange={(e) => setChapter(e.target.value)} />
        </label>
        <label className="text-sm space-y-1">
          <span className="font-medium">Topics (comma se alag)</span>
          <textarea className={input} rows={2} placeholder="Proper fractions, Addition, ..." value={topics} onChange={(e) => setTopics(e.target.value)} />
        </label>
        <div className="md:col-span-2">
          <button onClick={add} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60">
            <Plus className="h-4 w-4" /> {saving ? "Saving…" : "Add Chapter"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border font-semibold">
          {activeClass} — school dwara jode gaye chapters ({customRows.length})
        </div>
        {customRows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Abhi koi custom chapter nahi.</p>
        ) : (
          <ul className="divide-y divide-border">
            {customRows.map((r) => (
              <li key={r.id} className="p-4 flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{r.subject}</div>
                  {editId === r.id ? (
                    <div className="space-y-2 mt-1">
                      <input className={input} value={editCh} onChange={(e) => setEditCh(e.target.value)} />
                      <textarea className={input} rows={2} value={editTopics} onChange={(e) => setEditTopics(e.target.value)} />
                    </div>
                  ) : (
                    <>
                      <div className="font-medium">{r.chapter}</div>
                      <div className="text-sm text-muted-foreground">{r.topics.join(", ") || "—"}</div>
                    </>
                  )}
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${r.added_by_type === "student" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {r.added_by_type === "student" ? `👤 Added by ${r.added_by_name || "Student"}` : "🛡️ Admin"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {editId === r.id ? (
                    <>
                      <button onClick={saveEdit} className="p-2 rounded-md bg-primary text-primary-foreground" aria-label="Save"><Save className="h-4 w-4" /></button>
                      <button onClick={() => setEditId(null)} className="p-2 rounded-md border border-border" aria-label="Cancel"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => { setEditId(r.id); setEditCh(r.chapter); setEditTopics(r.topics.join(", ")); }} className="p-2 rounded-md border border-border" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => remove(r)} className="p-2 rounded-md border border-border text-destructive" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
