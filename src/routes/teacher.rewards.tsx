import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Gift,
  Plus,
  Pencil,
  Trash2,
  Save,
  FileText,
  CheckCircle2,
  XCircle,
  Truck,
  FileDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAllRules, getSetting, setSetting, type RewardRule } from "@/lib/rewards";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/teacher/rewards")({
  component: RewardsPage,
});

type ClaimRow = {
  id: string;
  student_id: string;
  rule_id: string;
  status: string;
  tests_count: number;
  avg_score: number;
  earned_at: string;
  notes: string | null;
  students: { name: string; student_class: string; roll_number: string } | null;
  reward_rules: { title: string } | null;
};

function RewardsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"rules" | "claims" | "settings">("rules");
  const [editing, setEditing] = useState<RewardRule | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: rules = [] } = useQuery({
    queryKey: ["reward-rules"],
    queryFn: fetchAllRules,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["reward-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_claims")
        .select(
          "id, student_id, rule_id, status, tests_count, avg_score, earned_at, notes, students(name, student_class, roll_number), reward_rules(title)",
        )
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ClaimRow[];
    },
  });

  async function deleteRule(id: string) {
    if (!confirm("Delete this reward rule?")) return;
    const { error } = await supabase.from("reward_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["reward-rules"] });
  }

  async function toggleActive(r: RewardRule) {
    const { error } = await supabase
      .from("reward_rules")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reward-rules"] });
  }

  async function updateClaim(id: string, status: string) {
    const patch: { status: string; approved_at?: string } = { status };
    if (status === "approved") patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from("reward_claims").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["reward-claims"] });
  }

  function exportClaims() {
    exportToExcel(
      claims.map((c) => ({
        Student: c.students?.name || "",
        Class: c.students?.student_class || "",
        Roll: c.students?.roll_number || "",
        Reward: c.reward_rules?.title || "",
        Tests: c.tests_count,
        AvgScore: c.avg_score + "%",
        Status: c.status,
        Date: new Date(c.earned_at).toLocaleString(),
      })),
      "reward-claims",
    );
  }

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Gift className="size-6" /> More Test, More Gift
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reward rules, T&amp;C, aur student claims manage karo.
          </p>
        </div>
        {tab === "rules" && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            <Plus className="size-4" /> Add reward
          </button>
        )}
        {tab === "claims" && claims.length > 0 && (
          <button
            onClick={exportClaims}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <FileDown className="size-4" /> Excel
          </button>
        )}
      </div>

      <div className="flex border-b border-border mb-4">
        {(
          [
            ["rules", "Gift Ladder"],
            ["claims", `Claims (${claims.filter((c) => c.status === "pending").length})`],
            ["settings", "T&C / Settings"],
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

      {tab === "rules" && (
        <div className="grid gap-3 md:grid-cols-2">
          {rules.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="font-display text-lg">No reward rules yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first gift.</p>
            </div>
          )}
          {rules.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 bg-card ${r.active ? "border-border" : "border-dashed border-border opacity-70"}`}
            >
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-xl bg-gradient-to-br from-amber-400 to-pink-500 text-white grid place-items-center text-2xl shrink-0">
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-semibold truncate">{r.title}</div>
                    {!r.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                        off
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-secondary">
                      {r.min_tests} tests
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary">
                      ≥ {r.min_score_percent}%
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary">
                      {r.cycle_days}d cycle
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary">
                      stock: {r.stock}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(r)}
                    className="p-2 rounded-md hover:bg-secondary"
                    title={r.active ? "Disable" : "Enable"}
                  >
                    <CheckCircle2 className={`size-4 ${r.active ? "text-emerald-600" : ""}`} />
                  </button>
                  <button
                    onClick={() => setEditing(r)}
                    className="p-2 rounded-md hover:bg-secondary"
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="p-2 rounded-md hover:bg-secondary text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "claims" && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Class · Roll</th>
                <th className="text-left p-3">Reward</th>
                <th className="text-left p-3">Progress</th>
                <th className="text-left p-3">Earned</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-muted-foreground">
                    No claims yet.
                  </td>
                </tr>
              )}
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/30">
                  <td className="p-3 font-medium">{c.students?.name || "—"}</td>
                  <td className="p-3 text-xs">
                    {c.students?.student_class} · {c.students?.roll_number}
                  </td>
                  <td className="p-3">{c.reward_rules?.title}</td>
                  <td className="p-3 text-xs">
                    {c.tests_count} tests · {c.avg_score}%
                  </td>
                  <td className="p-3 text-xs">{new Date(c.earned_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateClaim(c.id, "approved")}
                            className="p-1.5 rounded-md hover:bg-secondary text-emerald-600"
                            title="Approve"
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                          <button
                            onClick={() => updateClaim(c.id, "rejected")}
                            className="p-1.5 rounded-md hover:bg-secondary text-destructive"
                            title="Reject"
                          >
                            <XCircle className="size-4" />
                          </button>
                        </>
                      )}
                      {c.status === "approved" && (
                        <button
                          onClick={() => updateClaim(c.id, "delivered")}
                          className="p-1.5 rounded-md hover:bg-secondary text-primary"
                          title="Mark delivered"
                        >
                          <Truck className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && <SettingsTab />}

      {(creating || editing) && (
        <RuleDialog
          rule={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["reward-rules"] });
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    approved: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || "bg-secondary"}`}
    >
      {status}
    </span>
  );
}

function SettingsTab() {
  const [tc, setTc] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, e] = await Promise.all([
        getSetting<string>("terms_and_conditions"),
        getSetting<boolean>("reward_system_enabled"),
      ]);
      setTc(t || "");
      setEnabled(e !== false);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setSetting("terms_and_conditions", tc);
      await setSetting("reward_system_enabled", enabled);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4"
        />
        <div>
          <div className="font-medium">Reward system enabled</div>
          <div className="text-xs text-muted-foreground">
            Off karne pe students ke liye rewards hide ho jayenge.
          </div>
        </div>
      </label>

      <div>
        <label className="text-sm font-medium flex items-center gap-2">
          <FileText className="size-4" /> Terms &amp; Conditions
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Students ko test start karte time ye rules dikhaye jayenge.
        </p>
        <textarea
          value={tc}
          onChange={(e) => setTc(e.target.value)}
          rows={12}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono leading-relaxed"
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        <Save className="size-4" /> {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}

function RuleDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: RewardRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(rule?.title || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [minTests, setMinTests] = useState(rule?.min_tests || 10);
  const [minScore, setMinScore] = useState(rule?.min_score_percent || 80);
  const [cycleDays, setCycleDays] = useState(rule?.cycle_days || 30);
  const [stock, setStock] = useState(rule?.stock || 0);
  const [imageUrl, setImageUrl] = useState(rule?.image_url || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      min_tests: Number(minTests),
      min_score_percent: Number(minScore),
      cycle_days: Number(cycleDays),
      stock: Number(stock),
      image_url: imageUrl.trim() || null,
    };
    const { error } = rule
      ? await supabase.from("reward_rules").update(payload).eq("id", rule.id)
      : await supabase.from("reward_rules").insert({ ...payload, active: true });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit reward" : "Add reward"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Gift title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brand New Pen"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Description (optional)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Min tests">
              <input
                type="number"
                min={1}
                value={minTests}
                onChange={(e) => setMinTests(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Min score %">
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Cycle days">
              <input
                type="number"
                min={1}
                value={cycleDays}
                onChange={(e) => setCycleDays(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Stock">
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Image URL (optional)">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
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
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="size-4" /> {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
