import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  BookOpen,
  School,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  useCurriculum,
  CURRICULUM_KEY,
  type CustomRow,
  type SystemRow,
} from "@/lib/custom-curriculum";

export const Route = createFileRoute("/teacher/curriculum")({
  head: () => ({
    meta: [
      {
        title: "Syllabus Manager — Vertex Junior Academy",
      },
      {
        name: "description",
        content:
          "Manage system and school syllabus for classes, subjects, chapters and topics.",
      },
    ],
  }),
  component: CurriculumPage,
});

const splitTopics = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

function CurriculumPage() {
  const cur = useCurriculum();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"system" | "school">("system");

  const [cls, setCls] = useState("Class 1");
  const [subject, setSubject] = useState("");

  const [newClass, setNewClass] = useState("");
  const [newSubject, setNewSubject] = useState("");

  const [chapter, setChapter] = useState("");
  const [topics, setTopics] = useState("");

  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editClass, setEditClass] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editTopics, setEditTopics] = useState("");

  const [schoolSubject, setSchoolSubject] = useState("");

  const activeClass = newClass.trim() || cls;
  const activeSubject = newSubject.trim() || subject;

  const systemRows = cur.systemRows || [];
  const schoolRows = cur.customRows || [];

  const subjects = cur.subjectsFor(activeClass);

  const systemRowsForView = useMemo(() => {
    return systemRows.filter((row) => {
      const classMatch = row.student_class === activeClass;

      const subjectMatch =
        !subject || row.subject === activeSubject;

      return classMatch && subjectMatch;
    });
  }, [systemRows, activeClass, subject, activeSubject]);

  const schoolRowsForView = useMemo(() => {
    return schoolRows.filter((row) => {
      const classMatch = row.student_class === activeClass;

      const subjectMatch =
        !schoolSubject || row.subject === schoolSubject;

      return classMatch && subjectMatch;
    });
  }, [schoolRows, activeClass, schoolSubject]);

  const refresh = () => {
    qc.invalidateQueries({
      queryKey: CURRICULUM_KEY,
    });
  };

  /* -----------------------------
     Add System Chapter
  ------------------------------ */

  async function addSystemChapter() {
    const finalClass = activeClass.trim();
    const finalSubject = activeSubject.trim();
    const finalChapter = chapter.trim();

    if (!finalClass) {
      return toast.error("Class chunein");
    }

    if (!finalSubject) {
      return toast.error("Subject chunein ya likhein");
    }

    if (!finalChapter) {
      return toast.error("Chapter ka naam likhein");
    }

    setSaving(true);

    const { error } = await supabase
      .from("system_curriculum")
      .insert({
        student_class: finalClass,
        subject: finalSubject,
        chapter: finalChapter,
        topics: splitTopics(topics),
        is_active: true,
      });

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        return toast.error(
          "Ye Class + Subject + Chapter already exists.",
        );
      }

      return toast.error(error.message);
    }

    toast.success("System syllabus add ho gaya ✅");

    setChapter("");
    setTopics("");
    setNewClass("");
    setNewSubject("");

    setCls(finalClass);
    setSubject(finalSubject);

    refresh();
  }

  /* -----------------------------
     Add School Chapter
  ------------------------------ */

  async function addSchoolChapter() {
    const finalClass = activeClass.trim();
    const finalSubject =
      schoolSubject.trim() || activeSubject.trim();
    const finalChapter = chapter.trim();

    if (!finalClass) {
      return toast.error("Class chunein");
    }

    if (!finalSubject) {
      return toast.error("Subject chunein ya likhein");
    }

    if (!finalChapter) {
      return toast.error("Chapter ka naam likhein");
    }

    setSaving(true);

    const { error } = await supabase
      .from("custom_curriculum")
      .insert({
        student_class: finalClass,
        subject: finalSubject,
        chapter: finalChapter,
        topics: splitTopics(topics),
        added_by_type: "admin",
        added_by_name: "Admin",
      });

    setSaving(false);

    if (error) {
      return toast.error(error.message);
    }

    toast.success("School syllabus add ho gaya ✅");

    setChapter("");
    setTopics("");
    setNewClass("");
    setNewSubject("");

    setCls(finalClass);
    setSchoolSubject(finalSubject);

    refresh();
  }

  /* -----------------------------
     Start System Edit
  ------------------------------ */

  function startSystemEdit(row: SystemRow) {
    setEditId(row.id);
    setEditClass(row.student_class);
    setEditSubject(row.subject);
    setEditChapter(row.chapter);
    setEditTopics(row.topics.join(", "));
  }

  /* -----------------------------
     Save System Edit
  ------------------------------ */

  async function saveSystemEdit() {
    if (!editId) return;

    const finalClass = editClass.trim();
    const finalSubject = editSubject.trim();
    const finalChapter = editChapter.trim();

    if (!finalClass || !finalSubject || !finalChapter) {
      return toast.error(
        "Class, Subject aur Chapter zaroori hain.",
      );
    }

    const { error } = await supabase
      .from("system_curriculum")
      .update({
        student_class: finalClass,
        subject: finalSubject,
        chapter: finalChapter,
        topics: splitTopics(editTopics),
      })
      .eq("id", editId);

    if (error) {
      if (error.code === "23505") {
        return toast.error(
          "Ye Class + Subject + Chapter already exists.",
        );
      }

      return toast.error(error.message);
    }

    setEditId(null);

    toast.success("System syllabus update ho gaya ✅");

    refresh();
  }

  /* -----------------------------
     Delete System Chapter
  ------------------------------ */

  async function deleteSystem(row: SystemRow) {
    const ok = confirm(
      `"${row.chapter}" ko System Syllabus se delete karein?`,
    );

    if (!ok) return;

    const { error } = await supabase
      .from("system_curriculum")
      .delete()
      .eq("id", row.id);

    if (error) {
      return toast.error(error.message);
    }

    toast.success("System chapter delete ho gaya");

    refresh();
  }

  /* -----------------------------
     Edit School Chapter
  ------------------------------ */

  function startSchoolEdit(row: CustomRow) {
    setEditId(row.id);
    setEditClass(row.student_class);
    setEditSubject(row.subject);
    setEditChapter(row.chapter);
    setEditTopics(row.topics.join(", "));
  }

  /* -----------------------------
     Save School Edit
  ------------------------------ */

  async function saveSchoolEdit() {
    if (!editId) return;

    const finalClass = editClass.trim();
    const finalSubject = editSubject.trim();
    const finalChapter = editChapter.trim();

    if (!finalClass || !finalSubject || !finalChapter) {
      return toast.error(
        "Class, Subject aur Chapter zaroori hain.",
      );
    }

    const { error } = await supabase
      .from("custom_curriculum")
      .update({
        student_class: finalClass,
        subject: finalSubject,
        chapter: finalChapter,
        topics: splitTopics(editTopics),
      })
      .eq("id", editId);

    if (error) {
      return toast.error(error.message);
    }

    setEditId(null);

    toast.success("School syllabus update ho gaya ✅");

    refresh();
  }

  /* -----------------------------
     Delete School Chapter
  ------------------------------ */

  async function deleteSchool(row: CustomRow) {
    const ok = confirm(
      `"${row.chapter}" ko School Syllabus se delete karein?`,
    );

    if (!ok) return;

    const { error } = await supabase
      .from("custom_curriculum")
      .delete()
      .eq("id", row.id);

    if (error) {
      return toast.error(error.message);
    }

    toast.success("School chapter delete ho gaya");

    refresh();
  }

  const input =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="max-w-6xl space-y-6">
      {/* HEADER */}

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Syllabus Manager
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Class → Subject → Chapter → Topics ko manage karein.
        </p>
      </div>

      {/* TABS */}

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("system")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            tab === "system"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <ShieldCheck className="inline h-4 w-4 mr-1" />
          System Syllabus
        </button>

        <button
          onClick={() => setTab("school")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${
            tab === "school"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <School className="inline h-4 w-4 mr-1" />
          School Syllabus
        </button>
      </div>

      {/* COMMON SELECTOR */}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="font-medium">Class</span>

            <select
              className={input}
              value={cls}
              onChange={(e) => {
                setCls(e.target.value);
                setSubject("");
                setSchoolSubject("");
                setNewSubject("");
              }}
            >
              {cur.classes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <input
              className={input}
              placeholder="+ Nayi class"
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="font-medium">Subject</span>

            <select
              className={input}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSchoolSubject(e.target.value);
              }}
            >
              <option value="">— All Subjects —</option>

              {subjects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <input
              className={input}
              placeholder="+ Naya subject"
              value={newSubject}
              onChange={(e) =>
                setNewSubject(e.target.value)
              }
            />
          </label>
        </div>
      </div>

      {/* ADD FORM */}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold mb-3">
          {tab === "system"
            ? "➕ Add System Syllabus"
            : "➕ Add School Syllabus"}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="font-medium">Chapter</span>

            <input
              className={input}
              placeholder="e.g. Fractions"
              value={chapter}
              onChange={(e) =>
                setChapter(e.target.value)
              }
            />
          </label>

          <label className="text-sm space-y-1">
            <span className="font-medium">
              Topics
            </span>

            <textarea
              className={input}
              rows={2}
              placeholder="Addition, Subtraction, Proper Fractions"
              value={topics}
              onChange={(e) =>
                setTopics(e.target.value)
              }
            />

            <span className="text-xs text-muted-foreground">
              Comma या नई line से topics अलग करें.
            </span>
          </label>

          <div className="md:col-span-2">
            <button
              onClick={
                tab === "system"
                  ? addSystemChapter
                  : addSchoolChapter
              }
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />

              {saving
                ? "Saving..."
                : tab === "system"
                  ? "Add System Chapter"
                  : "Add School Chapter"}
            </button>
          </div>
        </div>
      </div>

      {/* SYSTEM LIST */}

      {tab === "system" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border">
            <div className="font-semibold">
              {activeClass}
              {activeSubject
                ? ` — ${activeSubject}`
                : " — All Subjects"}
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              System chapters: {systemRowsForView.length}
            </div>
          </div>

          {systemRowsForView.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">
              इस class के लिए database में कोई System
              Syllabus नहीं है।
              <br />
              <span className="text-xs">
                Default syllabus अभी fallback के रूप में
                उपलब्ध रहेगा।
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {systemRowsForView.map((row) => (
                <li
                  key={row.id}
                  className="p-4"
                >
                  {editId === row.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <input
                          className={input}
                          value={editClass}
                          onChange={(e) =>
                            setEditClass(e.target.value)
                          }
                        />

                        <input
                          className={input}
                          value={editSubject}
                          onChange={(e) =>
                            setEditSubject(e.target.value)
                          }
                        />

                        <input
                          className={input}
                          value={editChapter}
                          onChange={(e) =>
                            setEditChapter(e.target.value)
                          }
                        />
                      </div>

                      <textarea
                        className={input}
                        rows={3}
                        value={editTopics}
                        onChange={(e) =>
                          setEditTopics(e.target.value)
                        }
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={saveSystemEdit}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>

                        <button
                          onClick={() => setEditId(null)}
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">
                          {row.subject}
                        </div>

                        <div className="font-semibold">
                          {row.chapter}
                        </div>

                        <div className="text-sm text-muted-foreground mt-1">
                          {row.topics.length
                            ? row.topics.join(", ")
                            : "No topics"}
                        </div>

                        <span className="inline-block mt-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                          🛡️ System
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            startSystemEdit(row)
                          }
                          className="p-2 rounded-md border"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() =>
                            deleteSystem(row)
                          }
                          className="p-2 rounded-md border text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* SCHOOL LIST */}

      {tab === "school" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border">
            <div className="font-semibold">
              {activeClass}
              {schoolSubject
                ? ` — ${schoolSubject}`
                : " — All Subjects"}
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              School chapters: {schoolRowsForView.length}
            </div>
          </div>

          {schoolRowsForView.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              अभी कोई School/Student custom syllabus नहीं है।
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {schoolRowsForView.map((row) => (
                <li
                  key={row.id}
                  className="p-4"
                >
                  {editId === row.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <input
                          className={input}
                          value={editClass}
                          onChange={(e) =>
                            setEditClass(e.target.value)
                          }
                        />

                        <input
                          className={input}
                          value={editSubject}
                          onChange={(e) =>
                            setEditSubject(e.target.value)
                          }
                        />

                        <input
                          className={input}
                          value={editChapter}
                          onChange={(e) =>
                            setEditChapter(e.target.value)
                          }
                        />
                      </div>

                      <textarea
                        className={input}
                        rows={3}
                        value={editTopics}
                        onChange={(e) =>
                          setEditTopics(e.target.value)
                        }
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={saveSchoolEdit}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>

                        <button
                          onClick={() => setEditId(null)}
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">
                          {row.subject}
                        </div>

                        <div className="font-semibold">
                          {row.chapter}
                        </div>

                        <div className="text-sm text-muted-foreground mt-1">
                          {row.topics.length
                            ? row.topics.join(", ")
                            : "No topics"}
                        </div>

                        <span className="inline-block mt-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {row.added_by_type === "student"
                            ? `👤 Added by ${
                                row.added_by_name || "Student"
                              }`
                            : "🛡️ Admin"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            startSchoolEdit(row)
                          }
                          className="p-2 rounded-md border"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() =>
                            deleteSchool(row)
                          }
                          className="p-2 rounded-md border text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
