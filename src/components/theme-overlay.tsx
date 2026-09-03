import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pickActiveTheme, type SiteTheme } from "@/lib/themes";

/**
 * Applies the active site theme as *styling only*.
 * Only <style> blocks (and inline CSS) from the uploaded .html theme are used —
 * the theme's markup and scripts are never rendered, so the real React app
 * (dashboards, reports, tests, buttons) always stays on screen.
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
  const css = useMemo(() => (theme ? extractThemeCss(theme.html) : ""), [theme]);

  useEffect(() => {
    if (!css) return;
    const el = document.createElement("style");
    el.setAttribute("data-site-theme", "1");
    el.textContent = css;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [css]);

  return null;
}

/** Pull only CSS out of an uploaded theme document; ignore all markup/scripts. */
export function extractThemeCss(html: string): string {
  if (!html) return "";
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) blocks.push(m[1]);
  if (!blocks.length && !/<[a-z!/]/i.test(html)) blocks.push(html); // plain CSS file
  return blocks
    .join("\n")
    .replace(/@import[^;]*;/gi, "")
    .replace(/<\/?script[\s\S]*?>/gi, "")
    .trim();
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
