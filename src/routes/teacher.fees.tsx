import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wallet, Search, FileDown, FileText, Settings2, Receipt, Undo2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { generateReceiptPdf } from "@/lib/receipt";
import { format } from "date-fns";

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

type Payment = {
  id: string;
  student_id: string;
  receipt_no: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  transaction_id: string | null;
  notes: string | null;
  status: string;
  void_reason: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
const monthLabel = (m: number, y: number) => `${MONTHS[m - 1]} ${y}`;

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
        .select("student_id, monthly_fee, start_month, start_year, active");
      if (error) throw error;
      return (data || []) as Settings[];
    },
  });
  const records = useQuery({
    queryKey: ["fee-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_fee_records")
        .select("id, student_id, month, year, expected_amount, paid_amount, due_amount, status")
        .order("year")
        .order("month");
      if (error) throw error;
      return (data || []) as MonthRecord[];
    },
  });
  const payments = useQuery({
    queryKey: ["fee-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("id, student_id, receipt_no, amount, payment_date, payment_mode, transaction_id, notes, status, void_reason")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data || []) as Payment[];
    },
  });
  return { students, settings, records, payments };
}

function FeesPage() {
  const qc = useQueryClient();
  const { students, settings, records, payments } = useFeeData();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ledgerFor, setLedgerFor] = useState<Student | null>(null);
  const [settingsFor, setSettingsFor] = useState<Student | null>(null);
  const [payFor, setPayFor] = useState<Student | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fee-records"] });
    qc.invalidateQueries({ queryKey: ["fee-payments"] });
    qc.invalidateQueries({ queryKey: ["fee-settings"] });
  };

  const list = students.data || [];
  const settingsBy = useMemo(() => {
    const m = new Map<string, Settings>();
    for (const s of settings.data || []) m.set(s.student_id, s);
    return m;
  }, [settings.data]);

  const totalsBy = useMemo(() => {
    const m = new Map<string, { expected: number; paid: number; due: number; months: number }>();
    for (const r of records.data || []) {
      const t = m.get(r.student_id) || { expected: 0, paid: 0, due: 0, months: 0 };
      t.expected += Number(r.expected_amount);
      t.paid += Number(r.paid_amount);
      t.due += Number(r.due_amount);
      t.months += 1;
      m.set(r.student_id, t);
    }
    return m;
  }, [records.data]);

  const lastPayBy = useMemo(() => {
    const m = new Map<string, Payment>();
    for (const p of payments.data || []) {
      if (p.status !== "active") continue;
      if (!m.has(p.student_id)) m.set(p.student_id, p);
    }
    return m;
  }, [payments.data]);

  const classes = useMemo(
    () => Array.from(new Set(list.map((s) => s.student_class))).sort(),
    [list],
  );

  const rows = list.map((student) => {
    const t = totalsBy.get(student.id) || { expected: 0, paid: 0, due: 0, months: 0 };
    const cfg = settingsBy.get(student.id) || null;
    const status = !cfg ? "not_set" : t.due <= 0 ? "paid" : t.paid > 0 ? "partial" : "due";
    return { student, totals: t, cfg, status, lastPay: lastPayBy.get(student.id) || null };
  });

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !`${r.student.name} ${r.student.roll_number}`.toLowerCase().includes(q)) return false;
    if (classFilter && r.student.student_class !== classFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const summary = filtered.reduce(
    (a, r) => ({
      expected: a.expected + r.totals.expected,
      paid: a.paid + r.totals.paid,
      due: a.due + r.totals.due,
    }),
    { expected: 0, paid: 0, due: 0 },
  );

  function doExport(kind: "xlsx" | "pdf") {
    const data = filtered.map((r) => ({
      Name: r.student.name,
      Class: r.student.student_class,
      Roll: r.student.roll_number,
      "Monthly fee": Number(r.cfg?.monthly_fee || 0),
      Expected: r.totals.expected,
      Paid: r.totals.paid,
      Due: r.totals.due,
      "Last payment": r.lastPay ? format(new Date(r.lastPay.payment_date), "dd MMM yyyy") : "—",
      Status: r.status,
    }));
    if (kind === "xlsx") exportToExcel(data, "fees");
    else
      exportToPDF(
        "Monthly Fees",
        ["Name", "Class", "Roll", "Monthly", "Expected", "Paid", "Due", "Last payment", "Status"],
        data.map((d) => [
          d.Name, d.Class, d.Roll, d["Monthly fee"], d.Expected, d.Paid, d.Due, d["Last payment"], d.Status,
        ]),
        "fees",
      );
  }

  const loading = students.isLoading || records.isLoading;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Fees</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} students</p>
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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Expected" value={inr(summary.expected)} />
        <StatCard label="Collected" value={inr(summary.paid)} tone="success" />
        <StatCard label="Outstanding" value={inr(summary.due)} tone="danger" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 md:p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / roll"
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
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="due">Due</option>
          <option value="not_set">Not set</option>
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No students</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Class</th>
                  <th className="text-right p-3">Monthly</th>
                  <th className="text-right p-3">Expected</th>
                  <th className="text-right p-3">Paid</th>
                  <th className="text-right p-3">Due</th>
                  <th className="text-left p-3">Last payment</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(({ student, totals, cfg, status, lastPay }) => (
                  <tr key={student.id} className="hover:bg-secondary/30">
                    <td className="p-3 font-medium">
                      <button className="hover:underline" onClick={() => setLedgerFor(student)}>
                        {student.name}
                      </button>
                    </td>
                    <td className="p-3">{student.student_class}</td>
                    <td className="p-3 text-right">{cfg ? inr(cfg.monthly_fee) : "—"}</td>
                    <td className="p-3 text-right">{inr(totals.expected)}</td>
                    <td className="p-3 text-right">{inr(totals.paid)}</td>
                    <td className="p-3 text-right font-medium">{inr(totals.due)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {lastPay ? format(new Date(lastPay.payment_date), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="p-3"><StatusBadge status={status} /></td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1">
                      {cfg && (
                        <button
                          onClick={() => setPayFor(student)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--success)]/15 text-[var(--success)] hover:opacity-80"
                        >
                          <Wallet className="size-3" /> Pay
                        </button>
                      )}
                      <button
                        onClick={() => setLedgerFor(student)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent/40"
                      >
                        Ledger
                      </button>
                      <button
                        onClick={() => setSettingsFor(student)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent/40"
                      >
                        <Settings2 className="size-3" /> {cfg ? "Edit fee" : "Set fee"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {settingsFor && (
        <SettingsDialog
          student={settingsFor}
          current={settingsBy.get(settingsFor.id) || null}
          onClose={() => setSettingsFor(null)}
          onSaved={() => { refresh(); setSettingsFor(null); }}
        />
      )}
      {payFor && (
        <PaymentDialog
          student={payFor}
          records={(records.data || []).filter((r) => r.student_id === payFor.id)}
          onClose={() => setPayFor(null)}
          onSaved={() => { refresh(); setPayFor(null); }}
        />
      )}
      {ledgerFor && (
        <LedgerDialog
          student={ledgerFor}
          records={(records.data || []).filter((r) => r.student_id === ledgerFor.id)}
          payments={(payments.data || []).filter((p) => p.student_id === ledgerFor.id)}
          cfg={settingsBy.get(ledgerFor.id) || null}
          onClose={() => setLedgerFor(null)}
          onChanged={refresh}
          onPay={() => { setPayFor(ledgerFor); setLedgerFor(null); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const cls =
    tone === "success" ? "text-[var(--success)]" : tone === "danger" ? "text-destructive" : "";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    paid: { cls: "bg-[var(--success)]/15 text-[var(--success)]", label: "Paid" },
    partial: { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Partial" },
    due: { cls: "bg-destructive/10 text-destructive", label: "Due" },
    not_set: { cls: "bg-muted text-muted-foreground", label: "Not set" },
  };
  const s = map[status] || map["not_set"]!;
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

function SettingsDialog({
  student, current, onClose, onSaved,
}: {
  student: Student;
  current: Settings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const [fee, setFee] = useState(String(current?.monthly_fee ?? ""));
  const [month, setMonth] = useState(String(current?.start_month ?? now.getMonth() + 1));
  const [year, setYear] = useState(String(current?.start_year ?? now.getFullYear()));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(fee);
    if (!n || n <= 0) return toast.error("Enter a valid monthly fee");
    setSaving(true);
    const { error } = await supabase.rpc("fee_set_settings", {
      p_student: student.id,
      p_monthly_fee: n,
      p_start_month: Number(month),
      p_start_year: Number(year),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fee settings saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Monthly fee — {student.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Monthly fee (₹)">
            <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start month">
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Start year">
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Monthly rows are generated from the start month up to the current month. Paid months keep their
            original amount.
          </p>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  student, records, onClose, onSaved,
}: {
  student: Student;
  records: MonthRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const pending = records.filter((r) => Number(r.due_amount) > 0);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedDue = pending
    .filter((r) => selected.includes(r.id))
    .reduce((s, r) => s + Number(r.due_amount), 0);
  const totalDue = pending.reduce((s, r) => s + Number(r.due_amount), 0);
  const [amount, setAmount] = useState(String(totalDue || ""));
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mode, setMode] = useState("cash");
  const [txn, setTxn] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const sum = pending.filter((r) => next.includes(r.id)).reduce((s, r) => s + Number(r.due_amount), 0);
      setAmount(String(next.length ? sum : totalDue));
      return next;
    });
  }

  async function save() {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { data, error } = await supabase.rpc("fee_record_payment", {
      p_student: student.id,
      p_amount: n,
      p_date: date,
      p_mode: mode,
      p_transaction_id: txn || undefined,
      p_notes: notes || undefined,
      ...(selected.length ? { p_record_ids: selected } : {}),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    const pay = data as unknown as Payment | null;
    toast.success(`Payment recorded${pay?.receipt_no ? ` — ${pay.receipt_no}` : ""}`);
    if (pay) {
      generateReceiptPdf({
        receipt_no: pay.receipt_no,
        payment_date: pay.payment_date,
        paid_month: selected.length
          ? pending.filter((r) => selected.includes(r.id)).map((r) => monthLabel(r.month, r.year)).join(", ")
          : "Auto-allocated",
        amount: Number(pay.amount),
        due_amount: Math.max(totalDue - n, 0),
        payment_method: pay.payment_mode,
        status: "paid",
        student_name: student.name,
        student_class: student.student_class,
        course: student.course,
      });
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record payment — {student.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Total outstanding</span>
            <span className="font-semibold text-destructive">{inr(totalDue)}</span>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Apply to months (leave empty for oldest-first auto allocation)
            </div>
            <div className="rounded-xl border border-border divide-y divide-border max-h-48 overflow-y-auto">
              {pending.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No pending months — payment will go to advance months.</div>
              ) : pending.map((r) => (
                <label key={r.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-secondary/40">
                  <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                  <span className="flex-1">{monthLabel(r.month, r.year)}</span>
                  <span className="text-destructive font-medium">{inr(r.due_amount)}</span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">Selected due: {inr(selectedDue)}</div>
            )}
          </div>

          <Field label="Amount (₹)">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment mode">
              <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
              </select>
            </Field>
            <Field label="Payment date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Transaction ID (optional)">
            <input value={txn} onChange={(e) => setTxn(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Notes (optional)">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saving…" : "Record payment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LedgerDialog({
  student, records, payments, cfg, onClose, onChanged, onPay,
}: {
  student: Student;
  records: MonthRecord[];
  payments: Payment[];
  cfg: Settings | null;
  onClose: () => void;
  onChanged: () => void;
  onPay: () => void;
}) {
  const [editing, setEditing] = useState<Payment | null>(null);
  const totals = records.reduce(
    (a, r) => ({
      expected: a.expected + Number(r.expected_amount),
      paid: a.paid + Number(r.paid_amount),
      due: a.due + Number(r.due_amount),
    }),
    { expected: 0, paid: 0, due: 0 },
  );

  async function reverse(p: Payment) {
    const reason = window.prompt(`Reverse ${p.receipt_no}? Enter a reason:`);
    if (reason === null) return;
    const { error } = await supabase.rpc("fee_void_payment", { p_payment: p.id, p_reason: reason || "" });
    if (error) return toast.error(error.message);
    toast.success("Payment reversed");
    onChanged();
  }

  function receipt(p: Payment) {
    generateReceiptPdf({
      receipt_no: p.receipt_no,
      payment_date: p.payment_date,
      paid_month: cfg ? "Monthly fee" : "Fee",
      amount: Number(p.amount),
      due_amount: totals.due,
      payment_method: p.payment_mode,
      status: p.status === "active" ? "paid" : "void",
      student_name: student.name,
      student_class: student.student_class,
      course: student.course,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{student.name} — fee ledger</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Expected</div>
              <div className="font-semibold">{inr(totals.expected)}</div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="font-semibold text-[var(--success)]">{inr(totals.paid)}</div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Due</div>
              <div className="font-semibold text-destructive">{inr(totals.due)}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Month-wise records</div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Month</th>
                    <th className="text-right p-2">Expected</th>
                    <th className="text-right p-2">Paid</th>
                    <th className="text-right p-2">Due</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No monthly records — set the monthly fee first.</td></tr>
                  ) : records.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2">{monthLabel(r.month, r.year)}</td>
                      <td className="p-2 text-right">{inr(r.expected_amount)}</td>
                      <td className="p-2 text-right">{inr(r.paid_amount)}</td>
                      <td className="p-2 text-right">{inr(r.due_amount)}</td>
                      <td className="p-2"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Payment history</div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Receipt</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-left p-2">Mode</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No payments yet.</td></tr>
                  ) : payments.map((p) => (
                    <tr key={p.id} className={p.status === "void" ? "opacity-60" : ""}>
                      <td className="p-2 font-medium">
                        {p.receipt_no}
                        {p.status === "void" && <span className="ml-1 text-xs text-destructive">(reversed)</span>}
                      </td>
                      <td className="p-2">{format(new Date(p.payment_date), "dd MMM yyyy")}</td>
                      <td className="p-2 text-right">{inr(p.amount)}</td>
                      <td className="p-2 capitalize">{p.payment_mode}</td>
                      <td className="p-2 text-right whitespace-nowrap space-x-1">
                        <button onClick={() => receipt(p)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent/40">
                          <Receipt className="size-3" /> Receipt
                        </button>
                        {p.status === "active" && (
                          <>
                            <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent/40">
                              <Pencil className="size-3" /> Edit
                            </button>
                            <button onClick={() => reverse(p)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:opacity-80">
                              <Undo2 className="size-3" /> Reverse
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Close</button>
          {cfg && (
            <button onClick={onPay} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
              Record payment
            </button>
          )}
        </DialogFooter>
      </DialogContent>
      {editing && (
        <EditPaymentDialog
          payment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </Dialog>
  );
}

function EditPaymentDialog({
  payment, onClose, onSaved,
}: {
  payment: Payment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.payment_date);
  const [mode, setMode] = useState(payment.payment_mode);
  const [txn, setTxn] = useState(payment.transaction_id || "");
  const [notes, setNotes] = useState(payment.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { error } = await supabase.rpc("fee_edit_payment", {
      p_payment: payment.id,
      p_amount: n,
      p_date: date,
      p_mode: mode,
      p_transaction_id: txn || undefined,
      p_notes: notes || undefined,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment updated");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {payment.receipt_no}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Amount (₹)">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment mode">
              <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online</option>
              </select>
            </Field>
            <Field label="Payment date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Transaction ID">
            <input value={txn} onChange={(e) => setTxn(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
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
