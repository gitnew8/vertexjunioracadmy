import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ThemeFrame } from "@/components/theme-overlay";
import { istToday, isInWindow, pickActiveTheme, type SiteTheme } from "@/lib/themes";
import { Upload, Eye, Trash2, Zap, Star, Power, X } from "lucide-react";

export const Route = createFileRoute("/teacher/themes")({
  component: ThemesPage,
  head: () => ({ meta: [{ title: "Theme Manager — Vertex Junior Academy" }] }),
});

const EMPTY = {
  name: "",
  html: "",
  start_date: "",
  end_date: "",
  repeat_yearly: true,
  priority: 10,
  is_default: false,
};

function ThemesPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [preview, setPreview] = useState<SiteTheme | null>(null);

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ["site-themes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_themes")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SiteTheme[];
    },
  });

  const live = useMemo(() => pickActiveTheme(themes), [themes]);
  const today = istToday();

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Theme name is required");
      if (!form.html.trim()) throw new Error("Upload a .html theme file");
      const { error } = await supabase.from("site_themes").insert({
        name: form.name.trim(),
        html: form.html,
        start_date: form.start_date || null,
        end_date: form.end_date || form.start_date || null,
        repeat_yearly: form.repeat_yearly,
        priority: Number(form.priority) || 0,
        is_default: form.is_default,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Theme uploaded");
      setForm({ ...EMPTY });
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["site-themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<SiteTheme> }) => {
      const { error } = await supabase.from("site_themes").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-themes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_themes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Theme deleted");
      qc.invalidateQueries({ queryKey: ["site-themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Theme file must be under 2 MB");
      return;
    }
    const text = await f.text();
    setForm((s) => ({ ...s, html: text, name: s.name || f.name.replace(/\.html?$/i, "") }));
    toast.success(`${f.name} loaded (${Math.round(f.size / 1024)} KB)`);
  }

  async function forceActivate(t: SiteTheme) {
    // only one theme can be force-activated at a time
    const others = themes.filter((x) => x.force_active && x.id !== t.id);
    for (const o of others) await patch.mutateAsync({ id: o.id, values: { force_active: false } });
    await patch.mutateAsync({ id: t.id, values: { force_active: !t.force_active, active: true } });
    toast.success(t.force_active ? "Force activation removed" : `${t.name} force-activated`);
  }

  async function makeDefault(t: SiteTheme) {
    const others = themes.filter((x) => x.is_default && x.id !== t.id);
    for (const o of others) await patch.mutateAsync({ id: o.id, values: { is_default: false } });
    await patch.mutateAsync({ id: t.id, values: { is_default: !t.is_default } });
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">Theme Manager</h1>
        <p className="text-sm text-muted-foreground">
          Upload festive .html themes. The system checks the India (IST) date automatically —
          today is {String(today.d).padStart(2, "0")}/{String(today.m).padStart(2, "0")}/{today.y}.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Currently live</div>
        <div className="font-display text-lg font-semibold mt-1">
          {live ? live.name : "No theme (plain site)"}
          {live?.force_active && <span className="ml-2 text-xs text-amber-600">forced</span>}
          {live?.is_default && !live.force_active && (
            <span className="ml-2 text-xs text-muted-foreground">default</span>
          )}
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
        <div className="font-display font-semibold">Upload theme</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Theme name">
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Independence Day"
              className="input"
            />
          </Field>
          <Field label="Theme file (.html with CSS + JS inside)">
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={onFile}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Priority (higher wins)">
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((s) => ({ ...s, priority: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.repeat_yearly}
                onChange={(e) => setForm((s) => ({ ...s, repeat_yearly: e.target.checked }))}
              />
              Repeat every year
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((s) => ({ ...s, is_default: e.target.checked }))}
              />
              Default theme
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            <Upload className="size-4" /> {save.isPending ? "Saving…" : "Save theme"}
          </button>
          {form.html && (
            <button
              onClick={() =>
                setPreview({
                  id: "draft",
                  name: form.name || "Draft",
                  html: form.html,
                } as SiteTheme)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
            >
              <Eye className="size-4" /> Preview
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Themes run inside a sandboxed frame with no access to logins, tokens, storage or the
          database, and never block clicks on the app.
        </p>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 font-display font-semibold border-b border-border">All themes</div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : themes.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No themes uploaded yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {themes.map((t) => {
              const scheduledNow = isInWindow(t, today);
              return (
                <li key={t.id} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {t.name}
                      {live?.id === t.id && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5">
                          Live
                        </span>
                      )}
                      {t.is_default && (
                        <span className="text-[10px] uppercase rounded-full bg-secondary px-2 py-0.5">
                          Default
                        </span>
                      )}
                      {t.force_active && (
                        <span className="text-[10px] uppercase rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5">
                          Forced
                        </span>
                      )}
                      {!t.active && (
                        <span className="text-[10px] uppercase rounded-full bg-destructive/10 text-destructive px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.start_date ? `${t.start_date} → ${t.end_date || t.start_date}` : "No dates"}
                      {t.repeat_yearly ? " · yearly" : ""} · priority {t.priority}
                      {scheduledNow ? " · in season" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn title="Preview" onClick={() => setPreview(t)}>
                      <Eye className="size-4" />
                    </IconBtn>
                    <IconBtn
                      title={t.active ? "Deactivate" : "Activate"}
                      onClick={() => patch.mutate({ id: t.id, values: { active: !t.active } })}
                    >
                      <Power className={`size-4 ${t.active ? "text-emerald-600" : ""}`} />
                    </IconBtn>
                    <IconBtn title="Force activate" onClick={() => forceActivate(t)}>
                      <Zap className={`size-4 ${t.force_active ? "text-amber-600" : ""}`} />
                    </IconBtn>
                    <IconBtn title="Set as default" onClick={() => makeDefault(t)}>
                      <Star className={`size-4 ${t.is_default ? "text-primary" : ""}`} />
                    </IconBtn>
                    <IconBtn
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete theme "${t.name}"?`)) remove.mutate(t.id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </IconBtn>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 grid place-items-center">
          <div className="relative w-full max-w-4xl h-[70vh] rounded-2xl bg-card overflow-hidden border border-border">
            <div className="h-12 px-4 flex items-center justify-between border-b border-border">
              <div className="font-display font-semibold text-sm">Preview — {preview.name}</div>
              <button onClick={() => setPreview(null)} className="p-2 rounded-md hover:bg-secondary">
                <X className="size-4" />
              </button>
            </div>
            <ThemeFrame
              html={preview.html}
              name={preview.name}
              interactive
              className="w-full h-[calc(70vh-3rem)] border-0 bg-white"
            />
          </div>
        </div>
      )}

      <style>{`.input{width:100%;border:1px solid var(--border);background:var(--background);border-radius:.6rem;padding:.5rem .7rem;font-size:.875rem}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="p-2 rounded-md hover:bg-secondary border border-transparent hover:border-border"
    >
      {children}
    </button>
  );
}
