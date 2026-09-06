import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyPreviewCode } from "@/components/theme-overlay";
import {
  istToday,
  isInWindow,
  pickThemeForPath,
  THEME_TARGETS,
  type SiteTheme,
} from "@/lib/themes";
import {
  Upload,
  Eye,
  Trash2,
  Zap,
  Star,
  Power,
  X,
  Pencil,
  Copy,
  Save,
  RotateCcw,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/teacher/themes")({
  component: ThemesPage,
  head: () => ({
    meta: [
      { title: "Theme & Design Manager — Vertex Junior Academy" },
      {
        name: "description",
        content:
          "Paste and edit CSS, HTML and JavaScript to control any theme, animation or festival design, schedule it by date and target any page.",
      },
      { property: "og:title", content: "Theme & Design Manager — Vertex Junior Academy" },
      {
        property: "og:description",
        content: "Code-driven festival, seasonal and page-specific designs for the whole site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = {
  id: string;
  name: string;
  css: string;
  html: string;
  js: string;
  target: string;
  start_date: string;
  end_date: string;
  repeat_yearly: boolean;
  priority: number;
  is_default: boolean;
};

const EMPTY: Form = {
  id: "",
  name: "",
  css: "",
  html: "",
  js: "",
  target: "global",
  start_date: "",
  end_date: "",
  repeat_yearly: true,
  priority: 10,
  is_default: false,
};

const SAMPLE = `/* Paste ANY CSS here — variables, gradients, @keyframes, media queries */
body.theme-active { background: linear-gradient(160deg,#fff7ed,#ffedd5); }
body.student-dashboard .card, body.student-dashboard [class*="rounded-"] { transition: transform .25s ease; }
@keyframes floatUp { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
body.login-success main > * { animation: floatUp .5s ease both; }`;

function ThemesPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [tab, setTab] = useState<"css" | "html" | "js">("css");
  const [preview, setPreview] = useState<{ name: string; css: string; html: string; js: string } | null>(
    null,
  );

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

  const live = useMemo(() => pickThemeForPath(themes, "/teacher/themes"), [themes]);
  const today = istToday();

  useEffect(() => {
    if (!preview) return;
    return applyPreviewCode(preview);
  }, [preview]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const save = useMutation({
    mutationFn: async (activate?: boolean) => {
      if (!form.name.trim()) throw new Error("Theme name is required");
      if (!form.css.trim() && !form.html.trim() && !form.js.trim())
        throw new Error("Add some CSS, HTML or JavaScript first");
      const values = {
        name: form.name.trim(),
        css: form.css,
        html: form.html,
        js: form.js,
        target: form.target,
        start_date: form.start_date || null,
        end_date: form.end_date || form.start_date || null,
        repeat_yearly: form.repeat_yearly,
        priority: Number(form.priority) || 0,
        is_default: form.is_default,
        updated_at: new Date().toISOString(),
      };
      if (form.is_default) {
        await supabase.from("site_themes").update({ is_default: false }).neq("id", form.id || "0");
      }
      if (form.id) {
        const patch = activate ? { ...values, active: true } : values;
        const { error } = await supabase.from("site_themes").update(patch).eq("id", form.id);
        if (error) throw error;
        return form.id;
      }
      const { data, error } = await supabase
        .from("site_themes")
        .insert({ ...values, active: activate ?? false })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_id, activate) => {
      qc.invalidateQueries({ queryKey: ["site-themes"] });
      toast.success(activate ? "Theme saved and applied" : "Theme saved");
      setPreview(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchTheme = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SiteTheme> }) => {
      const { error } = await supabase
        .from("site_themes")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
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
      qc.invalidateQueries({ queryKey: ["site-themes"] });
      toast.success("Theme deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (t: SiteTheme) => {
      const { error } = await supabase.from("site_themes").insert({
        name: `${t.name} (copy)`,
        css: t.css || "",
        html: t.html || "",
        js: t.js || "",
        target: t.target || "global",
        start_date: t.start_date,
        end_date: t.end_date,
        repeat_yearly: t.repeat_yearly,
        priority: t.priority,
        active: false,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-themes"] });
      toast.success("Theme duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function edit(t: SiteTheme) {
    setForm({
      id: t.id,
      name: t.name,
      css: t.css || "",
      html: t.html || "",
      js: t.js || "",
      target: t.target || "global",
      start_date: t.start_date || "",
      end_date: t.end_date || "",
      repeat_yearly: t.repeat_yearly,
      priority: t.priority,
      is_default: t.is_default,
    });
    setTab("css");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onFile(file: File) {
    const text = await file.text();
    if (/\.css$/i.test(file.name)) set({ css: text, name: form.name || file.name.replace(/\.\w+$/, "") });
    else if (/\.js$/i.test(file.name)) set({ js: text, name: form.name || file.name.replace(/\.\w+$/, "") });
    else set({ html: text, name: form.name || file.name.replace(/\.\w+$/, "") });
    toast.success(`Loaded ${file.name}`);
  }

  const code = tab === "css" ? form.css : tab === "html" ? form.html : form.js;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Theme &amp; Design Manager</h1>
          <p className="text-sm text-muted-foreground">
            Paste your own CSS / HTML / JavaScript. Nothing is rewritten — code is stored and applied
            exactly as entered. No AI used.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">Live now:</span>{" "}
          <span className="font-medium">{live ? live.name : "Default design"}</span>
          <span className="ml-2 text-muted-foreground">
            IST {String(today.d).padStart(2, "0")}/{String(today.m).padStart(2, "0")}/{today.y}
          </span>
        </div>
      </header>

      {preview && (
        <div className="sticky top-2 z-50 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <span>
            Previewing <strong>{preview.name || "unsaved theme"}</strong> on the real page.
          </span>
          <button
            onClick={() => setPreview(null)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <X className="h-3.5 w-3.5" /> Stop preview
          </button>
        </div>
      )}

      {/* Editor */}
      <section className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Theme name</span>
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Independence Day"
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Applies to</span>
            <select
              value={form.target.startsWith("path:") ? "path:/" : form.target}
              onChange={(e) => set({ target: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              {THEME_TARGETS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {form.target.startsWith("path:") && (
              <input
                value={form.target.slice(5)}
                onChange={(e) => set({ target: `path:${e.target.value}` })}
                placeholder="/student/reading"
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              />
            )}
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Start date</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set({ start_date: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">End date</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set({ end_date: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.repeat_yearly}
              onChange={(e) => set({ repeat_yearly: e.target.checked })}
            />
            Repeat every year
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => set({ is_default: e.target.checked })}
            />
            Default theme
          </label>
          <label className="inline-flex items-center gap-2">
            Priority
            <input
              type="number"
              value={form.priority}
              onChange={(e) => set({ priority: Number(e.target.value) })}
              className="w-20 rounded-md border bg-background px-2 py-1"
            />
          </label>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" /> Load .css / .html / .js
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".css,.html,.htm,.js,text/css,text/html,text/javascript"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-4">
          <div className="flex gap-1 border-b">
            {(["css", "html", "js"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-t-md px-3 py-1.5 text-xs font-medium uppercase ${
                  tab === k ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                {k}
              </button>
            ))}
            {tab === "css" && !form.css && (
              <button
                onClick={() => set({ css: SAMPLE })}
                className="ml-auto px-3 py-1.5 text-xs text-primary"
              >
                Insert starter CSS
              </button>
            )}
          </div>
          <textarea
            value={code}
            spellCheck={false}
            onChange={(e) =>
              set(tab === "css" ? { css: e.target.value } : tab === "html" ? { html: e.target.value } : { js: e.target.value })
            }
            placeholder={
              tab === "css"
                ? "Paste CSS — variables, gradients, @keyframes, hover, media queries…"
                : tab === "html"
                  ? "Optional decorations (banners, popups, gift boxes). Rendered in a separate layer above the app."
                  : "Optional JavaScript. Return a function to clean up when the theme is removed."
            }
            className="mt-2 h-72 w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() =>
              setPreview({ name: form.name, css: form.css, html: form.html, js: form.js })
            }
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button
            onClick={() => save.mutate(undefined)}
            disabled={save.isPending}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
          >
            <Save className="h-4 w-4" /> Save
          </button>
          <button
            onClick={() => save.mutate(true)}
            disabled={save.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Zap className="h-4 w-4" /> Save &amp; Apply
          </button>
          <button
            onClick={() => {
              setForm({ ...EMPTY });
              setPreview(null);
            }}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
          >
            {form.id ? <Plus className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {form.id ? "New theme" : "Reset editor"}
          </button>
          <button
            onClick={async () => {
              await supabase.from("site_themes").update({ active: false, force_active: false }).neq("id", "0");
              qc.invalidateQueries({ queryKey: ["site-themes"] });
              setPreview(null);
              toast.success("All themes disabled — original design restored");
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
          >
            <Power className="h-4 w-4" /> Disable all themes
          </button>
        </div>
      </section>

      {/* Saved themes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saved themes</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !themes.length && (
          <p className="text-sm text-muted-foreground">No themes yet. Paste your code above and save.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {themes.map((t) => {
            const scheduled = isInWindow(t, today);
            const isLive = live?.id === t.id;
            return (
              <article key={t.id} className="rounded-xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {THEME_TARGETS.find((x) => x.value === (t.target || "global"))?.label}
                      {t.start_date
                        ? ` · ${t.start_date}${t.end_date && t.end_date !== t.start_date ? ` → ${t.end_date}` : ""}${t.repeat_yearly ? " (yearly)" : ""}`
                        : " · always"}
                      {` · priority ${t.priority}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {isLive && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        LIVE
                      </span>
                    )}
                    {t.force_active && (
                      <span className="rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-semibold">
                        FORCED
                      </span>
                    )}
                    {t.is_default && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                        DEFAULT
                      </span>
                    )}
                    {scheduled && (
                      <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-semibold">
                        IN SEASON
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <button
                    onClick={() =>
                      setPreview({ name: t.name, css: t.css || "", html: t.html || "", js: t.js || "" })
                    }
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => edit(t)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => duplicate.mutate(t)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  <button
                    onClick={() => patchTheme.mutate({ id: t.id, patch: { active: !t.active } })}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <Power className="h-3.5 w-3.5" /> {t.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() =>
                      patchTheme.mutate({
                        id: t.id,
                        patch: { force_active: !t.force_active, active: true },
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <Zap className="h-3.5 w-3.5" /> {t.force_active ? "Unforce" : "Force"}
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from("site_themes").update({ is_default: false }).neq("id", t.id);
                      patchTheme.mutate({ id: t.id, patch: { is_default: true, active: true } });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <Star className="h-3.5 w-3.5" /> Default
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete theme "${t.name}"?`)) remove.mutate(t.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
