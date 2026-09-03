import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pickActiveTheme, type SiteTheme } from "@/lib/themes";

/**
 * Renders the currently active site theme inside a fully sandboxed iframe.
 * The iframe has no `allow-same-origin`, so theme HTML/CSS/JS runs in an opaque
 * origin: it cannot read cookies, localStorage, the database, or the parent DOM.
 * The overlay is click-through so app functionality is never blocked.
 */
export function ThemeOverlay() {
  const [themes, setThemes] = useState<SiteTheme[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("site_themes")
        .select("*")
        .eq("active", true);
      if (!cancelled) setThemes((data as SiteTheme[]) || []);
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const theme = useMemo(() => (themes ? pickActiveTheme(themes) : null), [themes]);
  if (!theme) return null;

  return <ThemeFrame key={theme.id} html={theme.html} name={theme.name} />;
}

export function buildThemeDoc(html: string) {
  const base = `<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>`;
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${base}`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${base}</head><body>${html}</body></html>`;
}

export function ThemeFrame({
  html,
  name,
  interactive = false,
  className = "",
}: {
  html: string;
  name: string;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <iframe
      title={`Theme: ${name}`}
      aria-hidden={!interactive}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={buildThemeDoc(html)}
      className={
        className ||
        `fixed inset-0 z-[9998] h-full w-full border-0 bg-transparent ${
          interactive ? "" : "pointer-events-none"
        }`
      }
      style={{ background: "transparent" }}
    />
  );
}
