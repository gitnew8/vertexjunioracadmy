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
    const id = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const theme = useMemo(() => (themes ? pickActiveTheme(themes) : null), [themes]);
  const css = useMemo(() => (theme ? buildLiveThemeCss(theme.html) : ""), [theme]);

  useEffect(() => {
    document.querySelectorAll("style[data-site-theme]").forEach((n) => n.remove());
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

function ruleBody(css: string, selector: string): string {
  const re = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "i");
  return re.exec(css)?.[1] ?? "";
}

function decl(body: string, prop: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
  const v = re.exec(body)?.[1];
  return v ? v.trim() : null;
}

const NEUTRAL = /^(#fff(f{3})?|#ffffff|white|#f\w{2}|transparent)$/i;

/**
 * Themes are authored as standalone pages, so their class names don't exist in
 * the app. Bridge the theme palette onto the app's design tokens so the LIVE
 * theme visibly restyles the real pages (header, cards, buttons, tables, inputs)
 * without rendering any of the uploaded markup.
 */
export function buildLiveThemeCss(html: string): string {
  const css = extractThemeCss(html);
  if (!css) return "";

  const rootBody = ruleBody(css, ":root");
  const vars: Array<[string, string]> = [];
  const varRe = /--([\w-]+)\s*:\s*([^;]+)/g;
  let m: RegExpExecArray | null;
  while ((m = varRe.exec(rootBody))) vars.push([m[1].toLowerCase(), m[2].trim()]);

  const colors = vars.filter(([, v]) => /^(#|rgb|hsl)/i.test(v) && !NEUTRAL.test(v));
  const find = (re: RegExp) => colors.find(([k]) => re.test(k))?.[1];

  const primary =
    find(/primary|navy|brand|main|deep|dark/) || colors[0]?.[1] || null;
  const accent =
    find(/secondary|accent|gold|saffron|orange|green|red/) ||
    colors.find(([, v]) => v !== primary)?.[1] ||
    primary;

  const bodyDecls = ruleBody(css, "body");
  const pageBg = decl(bodyDecls, "background") || decl(bodyDecls, "background-color");
  const fontFamily = decl(bodyDecls, "font-family");

  const bridge: string[] = [];
  if (primary) {
    bridge.push(`:root{--primary:${primary};--ring:${primary};--sidebar-primary:${primary};}`);
  }
  if (accent) {
    bridge.push(`:root{--accent:${accent};--warning:${accent};}`);
  }
  if (pageBg) {
    bridge.push(
      `html,body{background:${pageBg} !important;background-attachment:fixed !important;}`,
      `body [class*="bg-background"]{background-color:transparent !important;}`,
    );
  }
  if (fontFamily) bridge.push(`body{font-family:${fontFamily};}`);
  if (accent) {
    // slim decorative accent bar at the top of every page
    bridge.push(
      `body::before{content:"";position:fixed;top:0;left:0;right:0;height:6px;z-index:9999;pointer-events:none;background:linear-gradient(90deg,${accent},${primary || accent},${accent});}`,
    );
  }

  return `${css}\n\n/* --- theme bridge (app tokens) --- */\n${bridge.join("\n")}`;
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
