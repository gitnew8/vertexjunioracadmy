import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Wallet, Search, FileDown, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { format } from "date-fns";

export const Route = createFileRoute("/teacher/fees")({
  component: FeesPage,
});

type Student = {
  id: string;
  name: string;
  student_class: string;
  roll_number: string;
};

type Fee = {
  id: string;
  student_id: string;
  cycle_label: string;
  total_fee: number;
  paid_amount: number;
  due_amount: number | null;
  last_payment_date: string | null;
  payment_status: string | null;
};

function FeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingFor, setEditingFor] = useState<{ student: Student; fee: Fee | null } | null>(null);
  const [paymentFor, setPaymentFor] = useState<{ student: Student; fee: Fee } | null>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, name, student_class, roll_number")
        .order("name");
      return (data || []) as Student[];
    },
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["fees"],
    queryFn: async () => {
      const { data } = await supabase.from("fees").select("*");
      return (data || []) as Fee[];
    },
  });

  const classes = useMemo(() => Array.from(new Set(students.map((s) => s.student_class))).sort(), [students]);

  // Map student -> latest fee
  const feeByStudent = new Map<string, Fee>();
  for (const f of fees) {
    const existing = feeByStudent.get(f.student_id);
    if (!existing) feeByStudent.set(f.student_id, f);
  }

  const rows = students.map((s) => {
    const fee = feeByStudent.get(s.id) || null;
    return { student: s, fee };
  });

  const filtered = rows.filter(({ student, fee }) => {
    const q = search.trim().toLowerCase();
    if (q && !`${student.name} ${student.roll_number}`.toLowerCase().includes(q)) return false;
    if (classFilter && student.student_class !== classFilter) return false;
    if (statusFilter) {
      const status = fee?.payment_status || "due";
      if (statusFilter !== status) return false;
    }
    return true;
  });

  function doExport(kind: "xlsx" | "pdf") {
    const data = filtered.map(({ student, fee }) => ({
      Name: student.name,
      Class: student.student_class,
      Roll: student.roll_number,
      Total: Number(fee?.total_fee || 0),
      Paid: Number(fee?.paid_amount || 0),
      Due: Number(fee?.due_amount || 0),
      "Last payment": fee?.last_payment_date ? format(new Date(fee.last_payment_date), "dd MMM yyyy") : "—",
      Status: fee?.payment_status || "due",
    }));
    if (kind === "xlsx") exportToExcel(data, "fees");
    else
      exportToPDF(
        "Fees",
        ["Name", "Class", "Roll", "Total", "Paid", "Due", "Last payment", "Status"],
        data.map((r) => [r.Name, r.Class, r.Roll, r.Total, r.Paid, r.Due, r["Last payment"], r.Status]),
        "fees",
      );
  }

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
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No students</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Class</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Paid</th>
                  <th className="text-right p-3">Due</th>
                  <th className="text-left p-3">Last payment</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(({ student, fee }) => {
                  const status = fee?.payment_status || "due";
                  const badgeMap: Record<string, string> = {
                    paid: "bg-[var(--success)]/15 text-[var(--success)]",
                    partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    due: "bg-destructive/10 text-destructive",
                  };
                  const badge = badgeMap[status] || "bg-muted text-muted-foreground";
                  const labelMap: Record<string, string> = { paid: "Paid", partial: "Partial", due: "Pending" };
                  return (
                    <tr key={student.id} className="hover:bg-secondary/30">
                      <td className="p-3 font-medium">{student.name}</td>
                      <td className="p-3">{student.student_class}</td>
                      <td className="p-3 text-right">₹{Number(fee?.total_fee || 0).toLocaleString()}</td>
                      <td className="p-3 text-right">₹{Number(fee?.paid_amount || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-medium">
                        ₹{Number(fee?.due_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {fee?.last_payment_date ? format(new Date(fee.last_payment_date), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full capitalize font-medium ${badge}`}>
                          {fee ? labelMap[status] || status : "not set"}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {fee && fee.due_amount && Number(fee.due_amount) > 0 ? (
                          <button
                            onClick={() => setPaymentFor({ student, fee })}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--success)]/15 text-[var(--success)] hover:opacity-80 mr-1"
                          >
                            <Wallet className="size-3" /> Pay
                          </button>
                        ) : null}
                        <button
                          onClick={() => setEditingFor({ student, fee })}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent/40"
                        >
                          {fee ? "Edit" : <><Plus className="size-3" /> Set</>}
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

      {editingFor && (
        <SetFeeDialog
          student={editingFor.student}
          fee={editingFor.fee}
          onClose={() => setEditingFor(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["fees"] });
            setEditingFor(null);
          }}
        />
      )}
      {paymentFor && (
        <PaymentDialog
          student={paymentFor.student}
          fee={paymentFor.fee}
          onClose={() => setPaymentFor(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["fees"] });
            setPaymentFor(null);
          }}
        />
      )}
    </div>
  );
}

function SetFeeDialog({
  student,
  fee,
  onClose,
  onSaved,
}: {
  student: Student;
  fee: Fee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [total, setTotal] = useState(String(fee?.total_fee || ""));
  const [cycle, setCycle] = useState(fee?.cycle_label || format(new Date(), "MMM yyyy"));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(total);
    if (!n || n < 0) return toast.error("Enter valid total fee");
    setSaving(true);
    if (fee) {
      const { error } = await supabase
        .from("fees")
        .update({ total_fee: n, cycle_label: cycle })
        .eq("id", fee.id);
      setSaving(false);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("fees")
        .insert({ student_id: student.id, total_fee: n, cycle_label: cycle });
      setSaving(false);
      if (error) return toast.error(error.message);
    }
    toast.success("Fee saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set fee — {student.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Cycle (e.g. Nov 2026)">
            <input value={cycle} onChange={(e) => setCycle(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Total fee (₹)">
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={inputCls}
            />
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

function PaymentDialog({
  student,
  fee,
  onClose,
  onSaved,
}: {
  student: Student;
  fee: Fee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const due = Number(fee.due_amount || 0);
  const totalFee = Number(fee.total_fee || 0);
  const currentPaid = Number(fee.paid_amount || 0);
  const [amount, setAmount] = useState(String(due));
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState("cash");
  const [paidMonth, setPaidMonth] = useState(fee.cycle_label || format(new Date(), "MMM yyyy"));
  const [saving, setSaving] = useState(false);

  const n = Number(amount) || 0;
  const newPaid = currentPaid + n;
  const newDue = Math.max(totalFee - newPaid, 0);
  const computedStatus: "paid" | "partial" | "due" =
    newDue <= 0 ? "paid" : newPaid > 0 ? "partial" : "due";

  const statusBadge = {
    paid: { label: "Paid", cls: "bg-[var(--success)]/15 text-[var(--success)]" },
    partial: { label: "Partial", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    due: { label: "Pending", cls: "bg-destructive/10 text-destructive" },
  }[computedStatus];

  async function save() {
    if (!n || n <= 0) return toast.error("Enter valid amount");
    setSaving(true);
    const { error: feeErr } = await supabase
      .from("fees")
      .update({
        paid_amount: newPaid,
        last_payment_date: date,
      })
      .eq("id", fee.id);
    if (feeErr) {
      setSaving(false);
      return toast.error(feeErr.message);
    }
    const { error: payErr } = await supabase.from("payments").insert({
      student_id: student.id,
      fee_id: fee.id,
      amount: n,
      payment_date: date,
      paid_month: paidMonth,
      payment_method: method,
      status: computedStatus,
    });
    setSaving(false);
    if (payErr) return toast.error(payErr.message);
    toast.success("Payment recorded");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment — {student.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Fee</span>
              <span className="font-medium">₹{totalFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-medium">₹{currentPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Due</span>
              <span className="font-semibold text-destructive">₹{due.toLocaleString()}</span>
            </div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">After payment</span>
              <div className="flex items-center gap-2">
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Due</span>
              <span className={`font-semibold ${newDue > 0 ? "text-destructive" : "text-[var(--success)]"}`}>
                ₹{newDue.toLocaleString()}
              </span>
            </div>
          </div>

          <Field label="Amount (₹)">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Paid month (e.g. May 2026)">
            <input value={paidMonth} onChange={(e) => setPaidMonth(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Payment method">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
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
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || n <= 0 || n > due + 0.01}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Record payment"}
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
