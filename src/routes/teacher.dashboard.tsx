import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Sparkles, Wallet, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/teacher/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [studentsRes, reportsRes, feesRes] = await Promise.all([
        supabase.from("students").select("id, name, created_at, roll_number, student_class").order("created_at", { ascending: false }),
        supabase.from("reports").select("roll_number, created_at").gte("created_at", subMonths(new Date(), 6).toISOString()),
        supabase.from("fees").select("total_fee, paid_amount, due_amount"),
      ]);
      return {
        students: studentsRes.data || [],
        reports: reportsRes.data || [],
        fees: feesRes.data || [],
      };
    },
  });

  if (isLoading || !data) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  const total = data.students.length;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeRolls = new Set(
    data.reports.filter((r) => new Date(r.created_at) > thirtyDaysAgo).map((r) => r.roll_number),
  );
  const active = data.students.filter((s) => activeRolls.has(s.roll_number)).length;

  const monthStart = startOfMonth(new Date()).toISOString();
  const newThisMonth = data.students.filter((s) => s.created_at >= monthStart).length;

  const totalPaid = data.fees.reduce((sum, f) => sum + Number(f.paid_amount || 0), 0);
  const totalDue = data.fees.reduce((sum, f) => sum + Number(f.due_amount || 0), 0);

  // Admissions per month (last 6)
  const monthBuckets: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(new Date(), i));
    const next = startOfMonth(subMonths(new Date(), i - 1));
    const count = data.students.filter((s) => {
      const c = new Date(s.created_at);
      return c >= d && c < next;
    }).length;
    monthBuckets.push({ label: format(d, "MMM"), count });
  }

  const feeData = [
    { name: "Collected", value: totalPaid },
    { name: "Pending", value: totalDue },
  ];
  const COLORS = ["oklch(0.62 0.15 150)", "oklch(0.6 0.22 27)"];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of students and fees</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Users} label="Total Students" value={total} accent="primary" />
        <StatCard icon={UserCheck} label="Active (30d)" value={active} accent="success" />
        <StatCard icon={Sparkles} label="New This Month" value={newThisMonth} accent="accent" />
        <StatCard icon={Wallet} label="Total Due" value={`₹${totalDue.toLocaleString()}`} accent="danger" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-semibold mb-3">Admissions (last 6 months)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-semibold mb-3">Fee collection</div>
          <div className="h-64">
            {totalPaid + totalDue === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No fee data yet
              </div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={feeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {feeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: number) => `₹${v.toLocaleString()}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="font-display font-semibold mb-3">Recent admissions</div>
        {data.students.slice(0, 5).length === 0 ? (
          <p className="text-sm text-muted-foreground">No students registered yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.students.slice(0, 5).map((s) => (
              <li key={s.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">Class {s.student_class} · Roll {s.roll_number}</div>
                </div>
                <div className="text-xs text-muted-foreground">{format(new Date(s.created_at), "dd MMM yyyy")}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  accent: "primary" | "success" | "accent" | "danger";
}) {
  const bg = {
    primary: "bg-primary/10 text-primary",
    success: "bg-[var(--success)]/15 text-[var(--success)]",
    accent: "bg-accent/30 text-accent-foreground",
    danger: "bg-destructive/10 text-destructive",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className={`size-9 rounded-lg grid place-items-center ${bg}`}>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
