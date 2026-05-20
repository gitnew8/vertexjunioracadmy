import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, FileDown, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { format } from "date-fns";

export const Route = createFileRoute("/teacher/students")({
  component: StudentsPage,
});

type Student = {
  id: string;
  name: string;
  student_class: string;
  roll_number: string;
  login_number: string;
  course: string | null;
  status: string;
  created_at: string;
};

function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Student[];
    },
  });

  // Active = has a report in last 30 days
  const { data: activeRolls = new Set<string>() } = useQuery({
    queryKey: ["active-rolls"],
    queryFn: async () => {
      const thirty = new Date();
      thirty.setDate(thirty.getDate() - 30);
      const { data } = await supabase
        .from("reports")
        .select("roll_number")
        .gte("created_at", thirty.toISOString());
      return new Set((data || []).map((r) => r.roll_number));
    },
  });

  const classes = useMemo(() => Array.from(new Set(students.map((s) => s.student_class))).sort(), [students]);

  const isActive = (s: Student) =>
    s.status !== "inactive" && activeRolls.has(s.roll_number);

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (q && !`${s.name} ${s.roll_number} ${s.login_number}`.toLowerCase().includes(q)) return false;
    if (classFilter && s.student_class !== classFilter) return false;
    const active = isActive(s);
    if (statusFilter === "active" && !active) return false;
    if (statusFilter === "inactive" && active) return false;
    return true;
  });

  async function remove(s: Student) {
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
    qc.invalidateQueries({ queryKey: ["students"] });
    setDeleting(null);
  }

  function doExport(kind: "xlsx" | "pdf") {
    const rows = filtered.map((s) => ({
      Name: s.name,
      Class: s.student_class,
      Course: s.course || "",
      Roll: s.roll_number,
      "Login ID": s.login_number,
      Status: activeRolls.has(s.roll_number) ? "Active" : "Inactive",
      Registered: format(new Date(s.created_at), "dd MMM yyyy"),
    }));
    if (kind === "xlsx") exportToExcel(rows, "students");
    else
      exportToPDF(
        "Students",
        ["Name", "Class", "Course", "Roll", "Login ID", "Status", "Registered"],
        rows.map((r) => [r.Name, r.Class, r.Course, r.Roll, r["Login ID"], r.Status, r.Registered]),
        "students",
      );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {students.length}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => doExport("xlsx")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            <FileDown className="size-3.5" /> Excel
          </button>
          <button
            onClick={() => doExport("pdf")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            <FileText className="size-3.5" /> PDF
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:opacity-90"
          >
            <Plus className="size-3.5" /> Add student
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 md:p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / roll / login ID"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>Class {c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No students found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Roll</th>
                  <th className="text-left p-3">Class</th>
                  <th className="text-left p-3">Course</th>
                  <th className="text-left p-3">Login ID</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const active = isActive(s);
                  return (
                    <tr key={s.id} className="hover:bg-secondary/30">
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3">{s.roll_number}</td>
                      <td className="p-3">{s.student_class}</td>
                      <td className="p-3 text-muted-foreground">{s.course || "—"}</td>
                      <td className="p-3 font-mono text-xs">{s.login_number}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                            active
                              ? "bg-[var(--success)]/15 text-[var(--success)]"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${active ? "bg-[var(--success)]" : "bg-muted-foreground"}`} />
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setEditing(s)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          aria-label="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <StudentDialog
          student={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["students"] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <b>{deleting?.name}</b> and their fee records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove(deleting)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StudentDialog({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(student?.name || "");
  const [studentClass, setStudentClass] = useState(student?.student_class || "");
  const [course, setCourse] = useState(student?.course || "");
  const [rollNumber, setRollNumber] = useState(student?.roll_number || "");
  const [status, setStatus] = useState(student?.status || "active");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !studentClass.trim() || !rollNumber.trim()) {
      return toast.error("Name, class and roll required");
    }
    setSaving(true);
    if (student) {
      const { error } = await supabase
        .from("students")
        .update({ name, student_class: studentClass, roll_number: rollNumber, course: course || null, status })
        .eq("id", student.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    } else {
      const loginNumber = Math.floor(100000 + Math.random() * 900000).toString();
      const { error } = await supabase.from("students").insert({
        name,
        student_class: studentClass,
        roll_number: rollNumber,
        course: course || null,
        status,
        login_number: loginNumber,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success(`Added · Login ID: ${loginNumber}`);
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <input value={studentClass} onChange={(e) => setStudentClass(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Roll number">
              <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Course (optional)">
            <input value={course} onChange={(e) => setCourse(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1 text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
