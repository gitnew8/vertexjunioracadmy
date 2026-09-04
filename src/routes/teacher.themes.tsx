import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyPreviewCss } from "@/components/theme-overlay";
import { istToday, isInWindow, pickActiveTheme, type SiteTheme } from "@/lib/themes";
import { Upload, Eye, Trash2, Zap, Star, Power, X, Pencil } from "lucide-react";

export const Route = createFileRoute("/teacher/themes")({
  component: ThemesPage,
  head: () => ({
    meta: [
      { title: "Theme Manager — Vertex Junior Academy" },
      {
        name: "description",
        content:
          "Paste or upload festival, seasonal and custom theme code, schedule it by date and apply it site-wide as styling only.",
      },
      { property: "og:title", content: "Theme Manager — Vertex Junior Academy" },
      {
        property: "og:description",
        content: "Code-driven festival, seasonal and custom themes for the whole site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY = {
  id: "" as string,
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
  const [previewCode, setPreviewCode] = useState<{ name: string; html: string } | null>(null);

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

  // CSS-only live preview on the real page (no iframe, no uploaded JS)
  useEffect(() => {
    if (!previewCode) return;
    const cleanup = applyPreviewCss(previewCode.html);
    return cleanup;
  }, [previewCode]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Theme name is required");
      if (!form.html.trim()) throw new Error("Paste or upload your theme code");
      const values = {
        name: form.name.trim(),
        html: form.html,
        start_date: form.start_date || null,
        end_date: form.end_date || form.start_date || null,
        repeat_yearly: form.repeat_yearly,
        priority: Number(form.priority) || 0,
        is_default: form.is_default,
      };
      if (form.id) {
        const { error } = await supabase.from("site_themes").update(values).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_themes").insert({ ...values, active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Theme updated" : "Theme saved");
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
    setForm((s) => ({
      ...s,
      html: text,
      name: s.name || f.name.replace(/\.(html?|css)$/i, ""),
    }));
    toast.success(`${f.name} loaded (${Math.round(f.size / 1024)} KB)`);
  }

  function editTheme(t: SiteTheme) {
    setForm({
      id: t.id,
      name: t.name,
      html: t.html,
      start_date: t.start_date || "",
      end_date: t.end_date || "",
      repeat_yearly: t.repeat_yearly,
      priority: t.priority,
      is_default: t.is_default,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function forceActivate(t: SiteTheme) {
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
          Paste your own CSS/HTML theme code — only its styling is applied to the real pages.
          Scheduling uses the Asia/Kolkata date; today is{" "}
          {String(today.d).padStart(2, "0")}/{String(today.m).padStart(2, "0")}/{today.y}.
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

      {/* Editor */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-display font-semibold">
            {form.id ? "Edit theme code" : "New theme"}
          </div>
          {form.id && (
            <button
              onClick={() => {
                setForm({ ...EMPTY });
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-xs rounded-md border border-border px-3 py-1.5"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Theme name">
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Independence Day / Winter / Custom"
              className="input"
            />
          </Field>
          <Field label="Optional: load code from a .html or .css file">
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,.css,text/html,text/css"
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
          <div className="flex items-end gap-4 pb-1 flex-wrap">
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

        <Field label="Theme code (paste CSS, or HTML containing <style> blocks)">
          <textarea
            value={form.html}
            onChange={(e) => setForm((s) => ({ ...s, html: e.target.value }))}
            spellCheck={false}
            rows={12}
            placeholder={`:root{--primary:#0b3d2e;--accent:#f59e0b}\nbody{background:linear-gradient(180deg,#fff7ed,#ffedd5)}`}
            className="input font-mono text-xs leading-relaxed min-h-48"
          />
        </Field>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            <Upload className="size-4" />
            {save.isPending ? "Saving…" : form.id ? "Update theme" : "Save theme"}
          </button>
          {form.html.trim() && (
            <button
              onClick={() =>
                setPreviewCode({ name: form.name || "Draft", html: form.html })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
            >
              <Eye className="size-4" /> Preview on this page
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Only stylesheet rules are used. Uploaded markup and JavaScript are never rendered or
          executed, so logins, students, tests and reports stay exactly as they are.
        </p>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 font-display font-semibold border-b border-border">All themes</div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : themes.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No themes yet.</div>
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
                  <div className="flex items-center gap-1 flex-wrap">
                    <IconBtn
                      title="Preview"
                      onClick={() => setPreviewCode({ name: t.name, html: t.html })}
                    >
                      <Eye className="size-4" />
                    </IconBtn>
                    <IconBtn title="Edit code" onClick={() => editTheme(t)}>
                      <Pencil className="size-4" />
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

      {previewCode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg max-w-[92vw]">
          <span className="text-xs truncate">Previewing “{previewCode.name}” (not saved live)</span>
          <button
            onClick={() => setPreviewCode(null)}
            className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs"
          >
            <X className="size-3" /> Stop
          </button>
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
