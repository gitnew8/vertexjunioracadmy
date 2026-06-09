import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { toast, Toaster } from "sonner";
import { Video, Plus, Copy, Users, Play, Square, Trash2, ExternalLink, X } from "lucide-react";

export const Route = createFileRoute("/teacher/classes")({
  component: ClassesPage,
  head: () => ({ meta: [{ title: "Live Classes — Admin" }] }),
});

type LiveClass = {
  id: string;
  title: string;
  subject: string | null;
  student_class: string;
  room_code: string;
  teacher_name: string | null;
  scheduled_at: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

type Attendance = {
  id: string;
  student_name: string | null;
  student_class: string | null;
  joined_at: string;
  left_at: string | null;
};

const ADMIN_SESSION_KEY = "admin_ok_v1";

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ClassesPage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
  }, []);
  if (!ok) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Admin login required.</p>
          <Link to="/teacher" className="text-primary underline mt-2 inline-block">Go to login</Link>
        </div>
      </div>
    );
  }
  return (
    <AdminShell>
      <Toaster richColors position="top-center" />
      <Inner />
    </AdminShell>
  );
}

function Inner() {
  const [items, setItems] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState<LiveClass | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("live_classes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as LiveClass[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function startClass(c: LiveClass) {
    const { error } = await supabase
      .from("live_classes")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Class started — share the link with students");
    load();
    window.open(`https://meet.jit.si/Vertex-${c.room_code}#config.prejoinPageEnabled=false`, "_blank");
  }

  async function endClass(c: LiveClass) {
    const { error } = await supabase
      .from("live_classes")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Class ended");
    load();
  }

  async function removeClass(c: LiveClass) {
    if (!confirm(`Delete "${c.title}"?`)) return;
    const { error } = await supabase.from("live_classes").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    load();
  }

  function copyLink(c: LiveClass) {
    const url = `${window.location.origin}/student/class/${c.room_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Student link copied");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Video className="size-6 text-primary" /> Live Classes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule classes, share join links, track attendance.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus className="size-4" /> New class
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Video className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-display text-lg">No classes yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click "New class" to create your first one.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold">{c.title}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Class {c.student_class}{c.subject ? ` · ${c.subject}` : ""}{c.teacher_name ? ` · ${c.teacher_name}` : ""}
                  </div>
                  <div className="text-xs mt-1 font-mono text-muted-foreground">Code: {c.room_code}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => copyLink(c)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
                  >
                    <Copy className="size-3.5" /> Copy link
                  </button>
                  <button
                    onClick={() => setAttendanceFor(c)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
                  >
                    <Users className="size-3.5" /> Attendance
                  </button>
                  {c.status !== "ended" ? (
                    <>
                      <button
                        onClick={() => startClass(c)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 text-white px-2.5 py-1.5 text-xs hover:opacity-90"
                      >
                        <Play className="size-3.5" /> {c.status === "live" ? "Rejoin" : "Start"}
                      </button>
                      {c.status === "live" && (
                        <button
                          onClick={() => endClass(c)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1.5 text-xs hover:opacity-90"
                        >
                          <Square className="size-3.5" /> End
                        </button>
                      )}
                    </>
                  ) : null}
                  <button
                    onClick={() => removeClass(c)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
      {attendanceFor && (
        <AttendanceModal cls={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse",
    ended: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${map[status] || map.scheduled}`}>
      {status === "live" ? "● LIVE" : status}
    </span>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !studentClass.trim()) return toast.error("Title and class are required");
    setSaving(true);
    const { error } = await supabase.from("live_classes").insert({
      title: title.trim(),
      subject: subject.trim() || null,
      student_class: studentClass.trim(),
      teacher_name: teacherName.trim() || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      room_code: makeCode(),
      status: "scheduled",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Class created");
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">New live class</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-secondary"><X className="size-4" /></button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Algebra Basics)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            placeholder="Class (e.g. 8)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <input
          value={teacherName}
          onChange={(e) => setTeacherName(e.target.value)}
          placeholder="Teacher name (optional)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="block text-xs text-muted-foreground">Scheduled for (optional)</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create class"}
        </button>
      </form>
    </div>
  );
}

function AttendanceModal({ cls, onClose }: { cls: LiveClass; onClose: () => void }) {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select("id, student_name, student_class, joined_at, left_at")
        .eq("class_id", cls.id)
        .order("joined_at", { ascending: true });
      setRows((data as Attendance[]) || []);
      setLoading(false);
    })();
  }, [cls.id]);

  function exportCSV() {
    const header = "Name,Class,Joined,Left\n";
    const body = rows.map(r => `"${r.student_name || ""}","${r.student_class || ""}","${r.joined_at}","${r.left_at || ""}"`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${cls.room_code}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Attendance</h2>
            <p className="text-xs text-muted-foreground">{cls.title} · {rows.length} joined</p>
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button onClick={exportCSV} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-secondary">Export CSV</button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X className="size-4" /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No students joined yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.student_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">Class {r.student_class || "—"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.joined_at).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
