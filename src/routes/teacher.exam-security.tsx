import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  Save,
  Activity,
  Camera,
  Mic,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import {
  DEFAULT_SETTINGS,
  fetchExamSecuritySettings,
  saveExamSecuritySettings,
  type ExamSecuritySettings,
  type ResultPolicy,
} from "@/lib/exam-security";

export const Route = createFileRoute("/teacher/exam-security")({
  component: ExamSecurityPage,
});

function ExamSecurityPage() {
  const [tab, setTab] = useState<"settings" | "monitor" | "attempts">("settings");

  return (
    <div className="p-5 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Shield className="size-6" /> Exam Security
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin-only controls. Students &amp; teachers cannot change these rules.
        </p>
      </div>

      <div className="flex border-b border-border mb-4">
        {(
          [
            ["settings", "Settings"],
            ["monitor", "Live Monitor"],
            ["attempts", "Attempts & Reports"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === k
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab />}
      {tab === "monitor" && <MonitorTab />}
      {tab === "attempts" && <AttemptsTab />}
    </div>
  );
}

function SettingsTab() {
  const [s, setS] = useState<ExamSecuritySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExamSecuritySettings().then((d) => {
      setS(d);
      setLoading(false);
    });
  }, []);

  function upd<K extends keyof ExamSecuritySettings>(k: K, v: ExamSecuritySettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const { id: _id, scope: _scope, ...patch } = s;
      void _id;
      void _scope;
      await saveExamSecuritySettings(patch);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 max-w-5xl">
      <Card title="System" icon={<Shield className="size-5" />}>
        <Toggle
          label="Enable exam security system"
          desc="Off karne pe koi bhi anti-cheat rule apply nahi hoga."
          checked={s.system_enabled}
          onChange={(v) => upd("system_enabled", v)}
        />
      </Card>

      <Card title="Fullscreen & Tab" icon={<Eye className="size-5" />}>
        <Toggle
          label="Fullscreen compulsory"
          desc="Test start hote hi fullscreen force ho."
          checked={s.fullscreen_required}
          onChange={(v) => upd("fullscreen_required", v)}
        />
        <NumberField
          label="Tab switch warning limit"
          desc="Kitne tab-change ke baad auto-submit ho. 0 = sirf log."
          value={s.tab_switch_limit}
          min={0}
          onChange={(v) => upd("tab_switch_limit", v)}
        />
      </Card>

      <Card title="Camera Monitoring" icon={<Camera className="size-5" />}>
        <Toggle
          label="Camera compulsory"
          desc="Random snapshots capture kiye jayenge."
          checked={s.camera_required}
          onChange={(v) => upd("camera_required", v)}
        />
        <NumberField
          label="Snapshot interval (sec)"
          value={s.camera_snapshot_interval_sec}
          min={10}
          onChange={(v) => upd("camera_snapshot_interval_sec", v)}
        />
      </Card>

      <Card title="Mic & AI" icon={<Mic className="size-5" />}>
        <Toggle
          label="Mic noise detection"
          checked={s.mic_monitoring}
          onChange={(v) => upd("mic_monitoring", v)}
        />
        <Toggle
          label="AI behaviour tracking"
          desc="Bahut fast / pattern-based answers ko flag kare."
          checked={s.ai_behavior_tracking}
          onChange={(v) => upd("ai_behavior_tracking", v)}
        />
      </Card>

      <Card title="Question Rules" icon={<Activity className="size-5" />}>
        <Toggle
          label="Randomize question order"
          checked={s.randomize_questions}
          onChange={(v) => upd("randomize_questions", v)}
        />
        <Toggle
          label="Randomize MCQ options"
          checked={s.randomize_options}
          onChange={(v) => upd("randomize_options", v)}
        />
        <NumberField
          label="Per-question timer (sec, 0 = off)"
          value={s.per_question_timer_sec}
          min={0}
          onChange={(v) => upd("per_question_timer_sec", v)}
        />
        <Toggle
          label="Allow skip / go back"
          checked={s.allow_skip}
          onChange={(v) => upd("allow_skip", v)}
        />
      </Card>

      <Card title="Copy / Screenshot" icon={<Ban className="size-5" />}>
        <Toggle
          label="Block copy, paste, right-click"
          checked={s.block_copy_paste}
          onChange={(v) => upd("block_copy_paste", v)}
        />
        <Toggle
          label="Block PrintScreen / Ctrl+P / Ctrl+S"
          checked={s.block_screenshot}
          onChange={(v) => upd("block_screenshot", v)}
        />
      </Card>

      <Card title="Auto Action" icon={<AlertTriangle className="size-5" />}>
        <NumberField
          label="Total warning limit"
          value={s.warning_limit}
          min={1}
          onChange={(v) => upd("warning_limit", v)}
        />
        <SelectField
          label="After limit"
          value={s.auto_action}
          options={[
            ["flag", "Only flag"],
            ["auto_submit", "Auto submit"],
            ["lock", "Lock test"],
          ]}
          onChange={(v) => upd("auto_action", v as ExamSecuritySettings["auto_action"])}
        />
      </Card>

      <Card title="Result Release Policy" icon={<CheckCircle2 className="size-5" />}>
        <PolicySelect
          label="Low risk"
          value={s.result_policy_low}
          onChange={(v) => upd("result_policy_low", v)}
        />
        <PolicySelect
          label="Medium risk"
          value={s.result_policy_medium}
          onChange={(v) => upd("result_policy_medium", v)}
        />
        <PolicySelect
          label="High risk"
          value={s.result_policy_high}
          onChange={(v) => upd("result_policy_high", v)}
        />
      </Card>

      <div className="md:col-span-2 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Save className="size-4" /> {saving ? "Saving…" : "Save all settings"}
        </button>
      </div>
    </div>
  );
}

function MonitorTab() {
  const { data: events = [] } = useQuery({
    queryKey: ["exam-events-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_security_events" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []) as unknown as {
        id: string;
        attempt_id: string;
        student_id: string;
        test_id: string;
        event_type: string;
        severity: string;
        created_at: string;
        payload: Record<string, unknown>;
      }[];
    },
    refetchInterval: 5000,
  });

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-3 border-b border-border text-sm text-muted-foreground">
        Auto-refresh every 5s. Last 200 security events.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Event</th>
              <th className="text-left p-3">Severity</th>
              <th className="text-left p-3">Attempt</th>
              <th className="text-left p-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center p-8 text-muted-foreground">
                  No security events yet.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-secondary/30">
                <td className="p-3 text-xs">{new Date(e.created_at).toLocaleTimeString()}</td>
                <td className="p-3 font-medium">{e.event_type}</td>
                <td className="p-3">
                  <SeverityBadge s={e.severity} />
                </td>
                <td className="p-3 text-xs font-mono">
                  {e.attempt_id ? e.attempt_id.slice(0, 8) : "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground truncate max-w-xs">
                  {JSON.stringify(e.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttemptsTab() {
  const qc = useQueryClient();
  const { data: attempts = [] } = useQuery({
    queryKey: ["exam-attempts-risk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_attempts")
        .select(
          "id, test_id, student_id, score, total, submitted_at, warnings_count, risk_score, risk_label, result_status, students(name, roll_number, student_class), tests(title)",
        )
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(100);
      return (data || []) as unknown as {
        id: string;
        score: number;
        total: number;
        submitted_at: string;
        warnings_count: number;
        risk_score: number;
        risk_label: string;
        result_status: string;
        students: { name: string; roll_number: string; student_class: string } | null;
        tests: { title: string } | null;
      }[];
    },
    refetchInterval: 10000,
  });

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("test_attempts")
      .update({ result_status: status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["exam-attempts-risk"] });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase">
          <tr>
            <th className="text-left p-3">Student</th>
            <th className="text-left p-3">Test</th>
            <th className="text-left p-3">Score</th>
            <th className="text-left p-3">Warnings</th>
            <th className="text-left p-3">Risk</th>
            <th className="text-left p-3">Status</th>
            <th className="text-right p-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {attempts.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center p-8 text-muted-foreground">
                No submitted attempts yet.
              </td>
            </tr>
          )}
          {attempts.map((a) => (
            <tr key={a.id} className="hover:bg-secondary/30">
              <td className="p-3 font-medium">
                {a.students?.name || "—"}
                <div className="text-xs text-muted-foreground">
                  {a.students?.student_class} · {a.students?.roll_number}
                </div>
              </td>
              <td className="p-3">{a.tests?.title || "—"}</td>
              <td className="p-3">
                {a.score}/{a.total}
              </td>
              <td className="p-3">{a.warnings_count}</td>
              <td className="p-3">
                <RiskBadge score={a.risk_score} label={a.risk_label} />
              </td>
              <td className="p-3">
                <StatusBadge s={a.result_status} />
              </td>
              <td className="p-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => updateStatus(a.id, "auto_released")}
                    className="p-1.5 rounded-md hover:bg-secondary text-emerald-600"
                    title="Approve & release"
                  >
                    <CheckCircle2 className="size-4" />
                  </button>
                  <button
                    onClick={() => updateStatus(a.id, "disqualified")}
                    className="p-1.5 rounded-md hover:bg-secondary text-destructive"
                    title="Disqualify"
                  >
                    <XCircle className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- UI helpers ---------- */

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 font-display font-semibold mb-3">
        {icon} {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
    </label>
  );
}

function NumberField({
  label,
  desc,
  value,
  onChange,
  min,
}: {
  label: string;
  desc?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function PolicySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ResultPolicy;
  onChange: (v: ResultPolicy) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(v) => onChange(v as ResultPolicy)}
      options={[
        ["release", "Auto release"],
        ["hold_teacher", "Hold — teacher review"],
        ["hold_admin", "Hold — admin decision"],
      ]}
    />
  );
}

function SeverityBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    high: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[s] || "bg-secondary"}`}>
      {s}
    </span>
  );
}

function RiskBadge({ score, label }: { score: number; label: string }) {
  const map: Record<string, string> = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    high: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[label] || "bg-secondary"}`}>
      {label} · {score}
    </span>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    auto_released: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    hold_teacher: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    hold_admin: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    disqualified: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || "bg-secondary"}`}>
      {s.replace(/_/g, " ")}
    </span>
  );
}
