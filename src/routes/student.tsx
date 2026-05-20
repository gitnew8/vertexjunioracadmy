import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ReportRow } from "@/lib/types";
import { GraduationCap, LogOut, Calendar, ExternalLink, Lock, UserPlus, Copy, CheckCircle2, Download, Receipt } from "lucide-react";
import { generateReceiptPdf } from "@/lib/receipt";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/student")({
  component: StudentPage,
  head: () => ({ meta: [{ title: "Student login — WeeklyReport" }] }),
});

const SESSION_KEY = "student_session_v2";

type Session = { name: string; student_class: string; roll_number: string; login_number: string };

function generateLoginNumber() {
  // 6-digit number, leading zeros allowed
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
}

function StudentPage() {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  });
  const [mode, setMode] = useState<"login" | "register">("login");

  function persist(s: Session | null) {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
    setSession(s);
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold">WeeklyReport</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              Student
            </span>
          </Link>
          {session && (
            <button
              onClick={() => persist(null)}
              className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-border px-3 py-1.5 hover:bg-secondary"
            >
              <LogOut className="size-4" /> Logout
            </button>
          )}
        </div>
      </header>

      {session ? (
        <StudentReports session={session} />
      ) : (
        <main className="mx-auto max-w-md px-5 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === "login" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === "register" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                Register
              </button>
            </div>

            {mode === "login" ? (
              <LoginForm onSuccess={persist} />
            ) : (
              <RegisterForm onLoginAfter={persist} />
            )}
          </div>
        </main>
      )}
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [loginNumber, setLoginNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = loginNumber.trim();
    if (!/^\d{6}$/.test(code)) return toast.error("Enter your 6-digit login number");
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("name, student_class, roll_number, login_number")
      .eq("login_number", code)
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Invalid login number");
    onSuccess(data as Session);
  }

  return (
    <>
      <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
        <Lock className="size-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold mt-4">Student login</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Enter the 6-digit login number you received when you registered.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Login number</label>
          <input
            inputMode="numeric"
            maxLength={6}
            value={loginNumber}
            onChange={(e) => setLoginNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tracking-widest text-center text-lg"
          />
        </div>
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Checking…" : "Login"}
        </button>
      </form>
    </>
  );
}

function RegisterForm({ onLoginAfter }: { onLoginAfter: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [issued, setIssued] = useState<Session | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const c = studentClass.trim();
    const r = rollNumber.trim();
    if (n.length < 2) return toast.error("Enter your full name");
    if (!c) return toast.error("Enter your class");
    if (!r) return toast.error("Enter your roll number");

    setLoading(true);
    // Try a few times in case of unique collision
    for (let i = 0; i < 5; i++) {
      const login_number = generateLoginNumber();
      const { data, error } = await supabase
        .from("students")
        .insert({ name: n, student_class: c, roll_number: r, login_number })
        .select("name, student_class, roll_number, login_number")
        .single();
      if (!error && data) {
        setIssued(data as Session);
        setLoading(false);
        return;
      }
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        setLoading(false);
        return toast.error(error.message);
      }
    }
    setLoading(false);
    toast.error("Could not generate a unique login number. Please try again.");
  }

  if (issued) {
    return (
      <div className="text-center">
        <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center mx-auto">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold mt-4">You're registered!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Save your login number. You'll need it every time you log in.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-5">
          <div className="text-xs text-muted-foreground">Your login number</div>
          <div className="font-mono text-3xl font-semibold tracking-widest mt-1">
            {issued.login_number}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(issued.login_number);
              toast.success("Copied");
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs rounded-lg border border-border px-3 py-1.5 hover:bg-background"
          >
            <Copy className="size-3.5" /> Copy
          </button>
        </div>
        <button
          onClick={() => onLoginAfter(issued)}
          className="mt-6 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90"
        >
          Continue to my reports
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
        <UserPlus className="size-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold mt-4">Create your account</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Register once and get a unique login number.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aarav Sharma"
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Class</label>
            <input
              value={studentClass}
              onChange={(e) => setStudentClass(e.target.value)}
              placeholder="VIII-B"
              maxLength={20}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Roll number</label>
            <input
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="14"
              maxLength={20}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Registering…" : "Register"}
        </button>
      </form>
    </>
  );
}

function StudentReports({ session }: { session: Session }) {
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .ilike("student_name", session.name)
        .order("week_start", { ascending: false });
      if (cancelled) return;
      if (error) toast.error(error.message);
      setReports((data as unknown as ReportRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.name]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl font-semibold">Hi, {session.name}</h1>
      <p className="text-muted-foreground mt-1">
        Class {session.student_class} · Roll {session.roll_number} · Login{" "}
        <span className="font-mono">{session.login_number}</span>
      </p>

      <FeeSummary session={session} />

      <MyTests session={session} />

      <PaymentHistory session={session} />







      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !reports || reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-display text-xl">No reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later — your teacher hasn't published one with this name.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const url = `/report/${r.code}`;
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold truncate">
                      {r.coaching_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(r.week_start).toLocaleDateString()} –{" "}
                      {new Date(r.week_end).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.subjects.length} subject{r.subjects.length === 1 ? "" : "s"} · Class{" "}
                      {r.student_class}
                    </div>
                  </div>
                  <a
                    href={url}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
                  >
                    Open <ExternalLink className="size-3.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function FeeSummary({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<{ total: number; paid: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      if (!student) {
        setTotals({ total: 0, paid: 0 });
        setLoading(false);
        return;
      }
      const { data: fees } = await supabase
        .from("fees")
        .select("total_fee, paid_amount")
        .eq("student_id", student.id);
      if (cancelled) return;
      const total = (fees ?? []).reduce((s, f) => s + Number(f.total_fee ?? 0), 0);
      const paid = (fees ?? []).reduce((s, f) => s + Number(f.paid_amount ?? 0), 0);
      setTotals({ total, paid });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.login_number]);

  const due = totals ? Math.max(totals.total - totals.paid, 0) : 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Fee Summary</h2>
        <span className="text-xs text-muted-foreground truncate">{session.name}</span>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      ) : !totals || totals.total === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No fee records yet. Your teacher hasn't set up your fees.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Fee</div>
            <div className="mt-1 text-2xl font-semibold font-display">{fmt(totals.total)}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Paid
            </div>
            <div className="mt-1 text-2xl font-semibold font-display text-emerald-700 dark:text-emerald-400">
              {fmt(totals.paid)}
            </div>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-400">Due</div>
            <div className="mt-1 text-2xl font-semibold font-display text-red-700 dark:text-red-400">
              {fmt(due)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type PaymentRow = {
  id: string;
  receipt_no: string;
  payment_date: string;
  paid_month: string;
  amount: number;
  payment_method: string;
  status: string;
};

function PaymentHistory({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [dueAmount, setDueAmount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      if (!student) {
        setPayments([]);
        setLoading(false);
        return;
      }
      setStudentId(student.id);

      const [{ data: pays }, { data: fees }] = await Promise.all([
        supabase
          .from("payments")
          .select("id, receipt_no, payment_date, paid_month, amount, payment_method, status")
          .eq("student_id", student.id)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("fees").select("total_fee, paid_amount").eq("student_id", student.id),
      ]);
      if (cancelled) return;
      const total = (fees ?? []).reduce((s, f) => s + Number(f.total_fee ?? 0), 0);
      const paid = (fees ?? []).reduce((s, f) => s + Number(f.paid_amount ?? 0), 0);
      setDueAmount(Math.max(total - paid, 0));
      setPayments((pays ?? []) as PaymentRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.login_number]);

  function download(p: PaymentRow) {
    generateReceiptPdf({
      receipt_no: p.receipt_no,
      payment_date: p.payment_date,
      paid_month: p.paid_month,
      amount: Number(p.amount),
      due_amount: dueAmount,
      payment_method: p.payment_method,
      status: p.status,
      student_name: session.name,
      student_class: session.student_class,
    });
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Receipt className="size-5" /> Payment History
        </h2>
        <span className="text-xs text-muted-foreground">{payments.length} payments</span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="text-sm text-muted-foreground">No payments recorded yet.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {payments.map((p) => {
              const paid = p.status === "paid";
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 ${
                    paid ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-semibold">{p.receipt_no}</div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        paid
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/15 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">{p.paid_month}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.payment_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {p.payment_method}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div
                      className={`text-lg font-semibold ${
                        paid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {fmt(Number(p.amount))}
                    </div>
                    <button
                      onClick={() => download(p)}
                      className="inline-flex items-center gap-1.5 text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90"
                    >
                      <Download className="size-3.5" /> PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-2.5">Receipt No</th>
                  <th className="text-left p-2.5">Payment Date</th>
                  <th className="text-left p-2.5">Paid Month</th>
                  <th className="text-right p-2.5">Amount</th>
                  <th className="text-left p-2.5">Method</th>
                  <th className="text-left p-2.5">Status</th>
                  <th className="text-right p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => {
                  const paid = p.status === "paid";
                  return (
                    <tr key={p.id} className="hover:bg-secondary/30">
                      <td className="p-2.5 font-mono text-xs font-semibold">{p.receipt_no}</td>
                      <td className="p-2.5">
                        {new Date(p.payment_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2.5">{p.paid_month}</td>
                      <td
                        className={`p-2.5 text-right font-semibold ${
                          paid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {fmt(Number(p.amount))}
                      </td>
                      <td className="p-2.5 capitalize text-muted-foreground">{p.payment_method}</td>
                      <td className="p-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            paid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-red-500/15 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => download(p)}
                          className="inline-flex items-center gap-1.5 text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90"
                        >
                          <Download className="size-3.5" /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}


