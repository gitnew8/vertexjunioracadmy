import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  FileDown,
  FileText,
  Pencil,
  Save,
  RotateCcw,
  Trash2,
  History,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportToExcel, exportToPDF } from "@/lib/export";

export const Route = createFileRoute("/teacher/fees")({
  component: FeesPage,
});

type Student = {
  id: string;
  name: string;
  student_class: string;
  roll_number: string;
  course: string | null;
};

type Settings = {
  student_id: string;
  monthly_fee: number;
  start_month: number;
  start_year: number;
  active: boolean;
};

type MonthRecord = {
  id: string;
  student_id: string;
  month: number;
  year: number;
  expected_amount: number;
  paid_amount: number;
  due_amount: number;
  status: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const inr = (value: number) =>
  "₹" + Number(value || 0).toLocaleString("en-IN");

function monthName(month: number) {
  return MONTHS[month - 1] || "";
}

function getStatus(expected: number, paid: number) {
  if (expected <= 0) return "not_set";
  if (paid >= expected) return "paid";
  if (paid > 0) return "partial";
  return "due";
}

function useFeeData() {
  const students = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, student_class, roll_number, course")
        .order("name");

      if (error) throw error;
      return (data || []) as Student[];
    },
  });

  const settings = useQuery({
    queryKey: ["fee-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_fee_settings")
        .select(
          "student_id, monthly_fee, start_month, start_year, active",
        );

      if (error) throw error;
      return (data || []) as Settings[];
    },
  });

  const records = useQuery({
    queryKey: ["fee-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_fee_records")
        .select(
          "id, student_id, month, year, expected_amount, paid_amount, due_amount, status",
        )
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      return (data || []) as MonthRecord[];
    },
  });

  return {
    students,
    settings,
    records,
  };
}

function FeesPage() {
  const qc = useQueryClient();
  const { students, settings, records } = useFeeData();

  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(
    now.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(
    now.getFullYear(),
  );

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [historyStudent, setHistoryStudent] =
    useState<Student | null>(null);

  const [editingStudent, setEditingStudent] =
    useState<Student | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fee-records"] });
    qc.invalidateQueries({ queryKey: ["fee-settings"] });
  };

  const studentList = students.data || [];
  const recordList = records.data || [];
  const settingList = settings.data || [];

  const settingsByStudent = useMemo(() => {
    const map = new Map<string, Settings>();

    for (const item of settingList) {
      map.set(item.student_id, item);
    }

    return map;
  }, [settingList]);

  const selectedRecords = useMemo(() => {
    const map = new Map<string, MonthRecord>();

    for (const record of recordList) {
      if (
        record.month === selectedMonth &&
        record.year === selectedYear
      ) {
        map.set(record.student_id, record);
      }
    }

    return map;
  }, [recordList, selectedMonth, selectedYear]);

  const classes = useMemo(() => {
    return Array.from(
      new Set(studentList.map((student) => student.student_class)),
    ).sort();
  }, [studentList]);

  const rows = useMemo(() => {
    return studentList.map((student) => {
      const record = selectedRecords.get(student.id);
      const setting = settingsByStudent.get(student.id);

      const expected = Number(
        record?.expected_amount ??
          setting?.monthly_fee ??
          0,
      );

      const paid = Number(record?.paid_amount ?? 0);

      const due = Math.max(expected - paid, 0);

      const status = getStatus(expected, paid);

      return {
        student,
        record,
        setting,
        expected,
        paid,
        due,
        status,
      };
    });
  }, [
    studentList,
    selectedRecords,
    settingsByStudent,
  ]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        q &&
        !`${row.student.name} ${row.student.roll_number}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }

      if (
        classFilter &&
        row.student.student_class !== classFilter
      ) {
        return false;
      }

      if (
        statusFilter &&
        row.status !== statusFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    rows,
    search,
    classFilter,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (total, row) => ({
        expected: total.expected + row.expected,
        paid: total.paid + row.paid,
        due: total.due + row.due,
      }),
      {
        expected: 0,
        paid: 0,
        due: 0,
      },
    );
  }, [filteredRows]);

  async function saveRecord(
    student: Student,
    expectedValue: string,
    paidValue: string,
  ) {
    const expected = Number(expectedValue);
    const paid = Number(paidValue);

    if (!Number.isFinite(expected) || expected < 0) {
      toast.error("Enter a valid monthly fee");
      return;
    }

    if (!Number.isFinite(paid) || paid < 0) {
      toast.error("Enter a valid received amount");
      return;
    }

    if (paid > expected) {
      toast.error(
        "Received amount cannot be greater than monthly fee",
      );
      return;
    }

    const due = Math.max(expected - paid, 0);

    const status =
      expected === 0
        ? "due"
        : paid === expected
          ? "paid"
          : paid > 0
            ? "partial"
            : "due";

    const { error } = await supabase
      .from("monthly_fee_records")
      .upsert(
        {
          student_id: student.id,
          month: selectedMonth,
          year: selectedYear,
          expected_amount: expected,
          paid_amount: paid,
          due_amount: due,
          status,
        },
        {
          onConflict: "student_id,month,year",
        },
      );

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      `${student.name} — ${monthName(selectedMonth)} ${selectedYear} saved`,
    );

    refresh();
  }

  async function resetRecord(student: Student) {
    const setting = settingsByStudent.get(student.id);

    const expected = Number(
      setting?.monthly_fee || 0,
    );

    const status = expected > 0 ? "due" : "due";

    const { error } = await supabase
      .from("monthly_fee_records")
      .upsert(
        {
          student_id: student.id,
          month: selectedMonth,
          year: selectedYear,
          expected_amount: expected,
          paid_amount: 0,
          due_amount: expected,
          status,
        },
        {
          onConflict: "student_id,month,year",
        },
      );

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      `${student.name} reset for ${monthName(selectedMonth)} ${selectedYear}`,
    );

    refresh();
  }

  async function deleteRecord(student: Student) {
    const record = selectedRecords.get(student.id);

    if (!record) {
      toast.info("No record exists for this month");
      return;
    }

    const ok = window.confirm(
      `Delete ${monthName(selectedMonth)} ${selectedYear} fee record for ${student.name}?`,
    );

    if (!ok) return;

    const { error } = await supabase
      .from("monthly_fee_records")
      .delete()
      .eq("id", record.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Monthly record deleted");

    refresh();
  }

  function exportData(kind: "xlsx" | "pdf") {
    const data = filteredRows.map((row) => ({
      Name: row.student.name,
      Class: row.student.student_class,
      Roll: row.student.roll_number,
      "Monthly Fee": row.expected,
      Received: row.paid,
      Due: row.due,
      Status: row.status,
    }));

    const filename = `fees-${selectedYear}-${String(
      selectedMonth,
    ).padStart(2, "0")}`;

    if (kind === "xlsx") {
      exportToExcel(data, filename);
      return;
    }

    exportToPDF(
      `${monthName(selectedMonth)} ${selectedYear} Fees`,
      [
        "Name",
        "Class",
        "Roll",
        "Monthly Fee",
        "Received",
        "Due",
        "Status",
      ],
      data.map((item) => [
        item.Name,
        item.Class,
        item.Roll,
        item["Monthly Fee"],
        item.Received,
        item.Due,
        item.Status,
      ]),
      filename,
    );
  }

  const loading =
    students.isLoading ||
    settings.isLoading ||
    records.isLoading;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">

      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Fee Control
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            {monthName(selectedMonth)} {selectedYear} — Monthly Ledger
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => exportData("xlsx")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            <FileDown className="size-3.5" />
            Excel
          </button>

          <button
            onClick={() => exportData("pdf")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            <FileText className="size-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* MONTH SELECTOR */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

          <Field label="Month">
            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(Number(e.target.value))
              }
              className={inputCls}
            >
              {MONTHS.map((month, index) => (
                <option
                  key={month}
                  value={index + 1}
                >
                  {month}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Year">
            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(Number(e.target.value))
              }
              className={inputCls}
            >
              {Array.from(
                { length: 8 },
                (_, i) => now.getFullYear() - 3 + i,
              ).map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Class">
            <select
              value={classFilter}
              onChange={(e) =>
                setClassFilter(e.target.value)
              }
              className={inputCls}
            >
              <option value="">All Classes</option>

              {classes.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  Class {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className={inputCls}
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="due">Due</option>
              <option value="not_set">Not Set</option>
            </select>
          </Field>

        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        <StatCard
          label="Total To Collect"
          value={inr(summary.expected)}
        />

        <StatCard
          label="This Month Received"
          value={inr(summary.paid)}
          tone="success"
        />

        <StatCard
          label="This Month Due"
          value={inr(summary.due)}
          tone="danger"
        />

      </div>

      {/* SEARCH */}
      <div className="rounded-2xl border border-border bg-card p-3">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search student name / roll number"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm"
          />
        </div>

      </div>

      {/* TABLE */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading fee records…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No students found.
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">

                <tr>

                  <th className="text-left p-3">
                    Student
                  </th>

                  <th className="text-left p-3">
                    Class
                  </th>

                  <th className="text-right p-3">
                    Monthly Fee
                  </th>

                  <th className="text-right p-3">
                    Received
                  </th>

                  <th className="text-right p-3">
                    Due
                  </th>

                  <th className="text-left p-3">
                    Status
                  </th>

                  <th className="text-right p-3">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-border">

                {filteredRows.map((row) => (

                  <FeeRow
                    key={row.student.id}
                    row={row}
                    onSave={saveRecord}
                    onReset={resetRecord}
                    onDelete={deleteRecord}
                    onHistory={() =>
                      setHistoryStudent(row.student)
                    }
                    onEdit={() =>
                      setEditingStudent(row.student)
                    }
                  />

                ))}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* EDIT DIALOG */}
      {editingStudent && (
        <EditMonthlyFeeDialog
          student={editingStudent}
          record={
            selectedRecords.get(editingStudent.id) || null
          }
          setting={
            settingsByStudent.get(editingStudent.id) || null
          }
          month={selectedMonth}
          year={selectedYear}
          onClose={() =>
            setEditingStudent(null)
          }
          onSaved={() => {
            setEditingStudent(null);
            refresh();
          }}
        />
      )}

      {/* HISTORY */}
      {historyStudent && (
        <HistoryDialog
          student={historyStudent}
          records={recordList.filter(
            (record) =>
              record.student_id === historyStudent.id,
          )}
          onClose={() =>
            setHistoryStudent(null)
          }
        />
      )}

    </div>
  );
}

function FeeRow({
  row,
  onSave,
  onReset,
  onDelete,
  onHistory,
  onEdit,
}: {
  row: {
    student: Student;
    record?: MonthRecord;
    setting?: Settings;
    expected: number;
    paid: number;
    due: number;
    status: string;
  };
  onSave: (
    student: Student,
    expected: string,
    paid: string,
  ) => void;
  onReset: (student: Student) => void;
  onDelete: (student: Student) => void;
  onHistory: () => void;
  onEdit: () => void;
}) {
  const [expected, setExpected] = useState(
    String(row.expected || ""),
  );

  const [paid, setPaid] = useState(
    String(row.paid || ""),
  );

  const calculatedDue = Math.max(
    Number(expected || 0) - Number(paid || 0),
    0,
  );

  return (
    <tr className="hover:bg-secondary/30">

      <td className="p-3">
        <button
          onClick={onHistory}
          className="font-medium hover:underline text-left"
        >
          {row.student.name}
        </button>

        <div className="text-xs text-muted-foreground">
          Roll: {row.student.roll_number || "—"}
        </div>
      </td>

      <td className="p-3">
        {row.student.student_class}
      </td>

      <td className="p-3 text-right">

        <input
          type="number"
          min="0"
          value={expected}
          onChange={(e) =>
            setExpected(e.target.value)
          }
          className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm"
        />

      </td>

      <td className="p-3 text-right">

        <input
          type="number"
          min="0"
          value={paid}
          onChange={(e) =>
            setPaid(e.target.value)
          }
          className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm"
        />

      </td>

      <td className="p-3 text-right font-semibold">

        {inr(calculatedDue)}

      </td>

      <td className="p-3">

        <StatusBadge
          status={getStatus(
            Number(expected || 0),
            Number(paid || 0),
          )}
        />

      </td>

      <td className="p-3 text-right">

        <div className="flex justify-end gap-1">

          <button
            title="Save"
            onClick={() =>
              onSave(
                row.student,
                expected,
                paid,
              )
            }
            className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-xs hover:opacity-90"
          >
            <Save className="size-3" />
            Save
          </button>

          <button
            title="Edit"
            onClick={onEdit}
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-2.5 py-1.5 hover:bg-accent"
          >
            <Pencil className="size-3" />
          </button>

          <button
            title="Reset"
            onClick={() => onReset(row.student)}
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-2.5 py-1.5 hover:bg-accent"
          >
            <RotateCcw className="size-3" />
          </button>

          {row.record && (
            <button
              title="Delete this month"
              onClick={() =>
                onDelete(row.student)
              }
              className="inline-flex items-center justify-center rounded-lg bg-destructive/10 text-destructive px-2.5 py-1.5 hover:opacity-80"
            >
              <Trash2 className="size-3" />
            </button>
          )}

        </div>

      </td>

    </tr>
  );
}

function EditMonthlyFeeDialog({
  student,
  record,
  setting,
  month,
  year,
  onClose,
  onSaved,
}: {
  student: Student;
  record: MonthRecord | null;
  setting: Settings | null;
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [expected, setExpected] = useState(
    String(
      record?.expected_amount ??
        setting?.monthly_fee ??
        "",
    ),
  );

  const [paid, setPaid] = useState(
    String(record?.paid_amount ?? 0),
  );

  const [saving, setSaving] = useState(false);

  const due = Math.max(
    Number(expected || 0) -
      Number(paid || 0),
    0,
  );

  async function save() {
    const expectedNumber = Number(expected);
    const paidNumber = Number(paid);

    if (
      !Number.isFinite(expectedNumber) ||
      expectedNumber < 0
    ) {
      toast.error("Enter a valid monthly fee");
      return;
    }

    if (
      !Number.isFinite(paidNumber) ||
      paidNumber < 0
    ) {
      toast.error("Enter a valid received amount");
      return;
    }

    if (paidNumber > expectedNumber) {
      toast.error(
        "Received cannot be greater than monthly fee",
      );
      return;
    }

    setSaving(true);

    const dueNumber = Math.max(
      expectedNumber - paidNumber,
      0,
    );

    const status =
      paidNumber === expectedNumber &&
      expectedNumber > 0
        ? "paid"
        : paidNumber > 0
          ? "partial"
          : "due";

    const { error } = await supabase
      .from("monthly_fee_records")
      .upsert(
        {
          student_id: student.id,
          month,
          year,
          expected_amount: expectedNumber,
          paid_amount: paidNumber,
          due_amount: dueNumber,
          status,
        },
        {
          onConflict:
            "student_id,month,year",
        },
      );

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Monthly fee saved");

    onSaved();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) =>
        !open && onClose()
      }
    >

      <DialogContent>

        <DialogHeader>

          <DialogTitle>
            {student.name} — {monthName(month)} {year}
          </DialogTitle>

        </DialogHeader>

        <div className="space-y-4">

          <div className="rounded-xl border border-border bg-secondary/40 p-3">

            <div className="text-xs text-muted-foreground">
              Selected month
            </div>

            <div className="font-semibold">
              {monthName(month)} {year}
            </div>

          </div>

          <Field label="Monthly Fee (₹)">

            <input
              type="number"
              min="0"
              value={expected}
              onChange={(e) =>
                setExpected(e.target.value)
              }
              className={inputCls}
            />

          </Field>

          <Field label="This Month Received (₹)">

            <input
              type="number"
              min="0"
              value={paid}
              onChange={(e) =>
                setPaid(e.target.value)
              }
              className={inputCls}
            />

          </Field>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl border border-border p-3">

              <div className="text-xs text-muted-foreground">
                Received
              </div>

              <div className="font-semibold text-[var(--success)]">
                {inr(Number(paid || 0))}
              </div>

            </div>

            <div className="rounded-xl border border-border p-3">

              <div className="text-xs text-muted-foreground">
                Due
              </div>

              <div className="font-semibold text-destructive">
                {inr(due)}
              </div>

            </div>

          </div>

          <p className="text-xs text-muted-foreground">
            This record belongs only to {monthName(month)}{" "}
            {year}. Previous or future months are not added
            to this month's amount.
          </p>

        </div>

        <DialogFooter>

          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancel
          </button>

          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>

        </DialogFooter>

      </DialogContent>

    </Dialog>
  );
}

function HistoryDialog({
  student,
  records,
  onClose,
}: {
  student: Student;
  records: MonthRecord[];
  onClose: () => void;
}) {
  const sorted = [...records].sort(
    (a, b) =>
      b.year - a.year ||
      b.month - a.month,
  );

  const totals = sorted.reduce(
    (total, record) => ({
      expected:
        total.expected +
        Number(record.expected_amount),
      paid:
        total.paid +
        Number(record.paid_amount),
      due:
        total.due +
        Number(record.due_amount),
    }),
    {
      expected: 0,
      paid: 0,
      due: 0,
    },
  );

  return (
    <Dialog
      open
      onOpenChange={(open) =>
        !open && onClose()
      }
    >

      <DialogContent className="max-w-3xl">

        <DialogHeader>

          <DialogTitle>
            {student.name} — Fee History
          </DialogTitle>

        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">

          <div className="grid grid-cols-3 gap-3">

            <StatCard
              label="Total Expected"
              value={inr(totals.expected)}
            />

            <StatCard
              label="Total Received"
              value={inr(totals.paid)}
              tone="success"
            />

            <StatCard
              label="Total Due"
              value={inr(totals.due)}
              tone="danger"
            />

          </div>

          <div className="rounded-xl border border-border overflow-hidden">

            {sorted.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No fee history found.
              </div>
            ) : (
              <table className="w-full text-sm">

                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">

                  <tr>
                    <th className="text-left p-3">
                      Month
                    </th>

                    <th className="text-right p-3">
                      Monthly Fee
                    </th>

                    <th className="text-right p-3">
                      Received
                    </th>

                    <th className="text-right p-3">
                      Due
                    </th>

                    <th className="text-left p-3">
                      Status
                    </th>
                  </tr>

                </thead>

                <tbody className="divide-y divide-border">

                  {sorted.map((record) => (

                    <tr key={record.id}>

                      <td className="p-3">
                        {monthName(record.month)}{" "}
                        {record.year}
                      </td>

                      <td className="p-3 text-right">
                        {inr(record.expected_amount)}
                      </td>

                      <td className="p-3 text-right">
                        {inr(record.paid_amount)}
                      </td>

                      <td className="p-3 text-right font-medium">
                        {inr(record.due_amount)}
                      </td>

                      <td className="p-3">
                        <StatusBadge
                          status={record.status}
                        />
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>
            )}

          </div>

        </div>

        <DialogFooter>

          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Close
          </button>

        </DialogFooter>

      </DialogContent>

    </Dialog>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const className =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "danger"
        ? "text-destructive"
        : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">

      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      <div
        className={`text-xl md:text-2xl font-semibold mt-1 ${className}`}
      >
        {value}
      </div>

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const map: Record<
    string,
    {
      className: string;
      label: string;
    }
  > = {
    paid: {
      className:
        "bg-[var(--success)]/15 text-[var(--success)]",
      label: "Paid",
    },

    partial: {
      className:
        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      label: "Partial",
    },

    due: {
      className:
        "bg-destructive/10 text-destructive",
      label: "Due",
    },

    not_set: {
      className:
        "bg-muted text-muted-foreground",
      label: "Not Set",
    },
  };

  const item =
    map[status] || map.due;

  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">

      <span className="text-xs font-medium block mb-1 text-muted-foreground">
        {label}
      </span>

      {children}

    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
