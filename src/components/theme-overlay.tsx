import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pageClasses, pickThemeForPath, type SiteTheme } from "@/lib/themes";

export type ThemeCode = { css?: string | null; html?: string | null; js?: string | null };

const STYLE_ATTR = "data-site-theme";
const HTML_ID = "site-theme-layer";
const SCRIPT_ATTR = "data-site-theme-js";

/**
 * Applies the active theme's code (CSS + optional HTML decorations + optional JS)
 * exactly as the admin entered it. The real React app always stays on screen —
 * theme HTML is rendered in a separate decoration layer, never in place of pages.
 */
export function ThemeOverlay() {
  const [themes, setThemes] = useState<SiteTheme[] | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from("site_themes").select("*").eq("active", true);
      if (!cancelled) setThemes((data as SiteTheme[]) || []);
    }
    load();
    const id = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const theme = useMemo(
    () => (themes ? pickThemeForPath(themes, pathname) : null),
    [themes, pathname],
  );

  // page + login-state hook classes for theme code
  useEffect(() => {
    const classes = pageClasses(pathname);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [pathname]);

  useEffect(() => {
    if (!theme) return;
    return applyThemeCode(theme, { attr: STYLE_ATTR, layerId: HTML_ID, scriptAttr: SCRIPT_ATTR });
  }, [theme?.id, theme?.updated_at, theme?.css, theme?.html, theme?.js]);

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

/** Strip <style>/<script> from pasted markup so only visible decorations render. */
function extractThemeMarkup(html: string): string {
  if (!html) return "";
  if (!/<[a-z!/]/i.test(html)) return ""; // plain CSS, not markup
  let body = html;
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch) body = bodyMatch[1];
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .trim();
}

/**
 * Injects theme code into the live document and returns a cleanup that fully
 * restores the original design. Nothing outside the injected style/layer/script
 * is touched, so app data and functionality are unaffected.
 */
export function applyThemeCode(
  code: ThemeCode,
  opts: { attr: string; layerId: string; scriptAttr: string },
): () => void {
  const css = (code.css || "").trim() || buildLiveThemeCss(code.html || "");
  const markup = extractThemeMarkup(code.html || "");
  const js = (code.js || "").trim();

  document.querySelectorAll(`style[${opts.attr}]`).forEach((n) => n.remove());
  document.getElementById(opts.layerId)?.remove();
  document.querySelectorAll(`script[${opts.scriptAttr}]`).forEach((n) => n.remove());

  const nodes: Element[] = [];

  if (css) {
    const style = document.createElement("style");
    style.setAttribute(opts.attr, "1");
    style.textContent = css; // stored & applied exactly as entered
    document.head.appendChild(style);
    nodes.push(style);
  }

  if (markup) {
    const layer = document.createElement("div");
    layer.id = opts.layerId;
    layer.className = "site-theme-layer";
    layer.innerHTML = markup;
    document.body.appendChild(layer);
    nodes.push(layer);
  }

  let cleanupFn: unknown;
  if (js) {
    try {
      // eslint-disable-next-line no-new-func
      cleanupFn = new Function(js)();
    } catch (err) {
      console.error("[theme] script error", err);
    }
  }

  return () => {
    if (typeof cleanupFn === "function") {
      try {
        (cleanupFn as () => void)();
      } catch {
        /* ignore */
      }
    }
    nodes.forEach((n) => n.remove());
  };
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
 * Legacy support: themes uploaded as a full .html document have no dedicated CSS
 * field, so their palette is bridged onto the app's design tokens.
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

  const primary = find(/primary|navy|brand|main|deep|dark/) || colors[0]?.[1] || null;
  const accent =
    find(/secondary|accent|gold|saffron|orange|green|red/) ||
    colors.find(([, v]) => v !== primary)?.[1] ||
    primary;

  const bodyDecls = ruleBody(css, "body");
  const pageBg = decl(bodyDecls, "background") || decl(bodyDecls, "background-color");
  const fontFamily = decl(bodyDecls, "font-family");

  const bridge: string[] = [];
  if (primary) bridge.push(`:root{--primary:${primary};--ring:${primary};--sidebar-primary:${primary};}`);
  if (accent) bridge.push(`:root{--accent:${accent};--warning:${accent};}`);
  if (pageBg) {
    bridge.push(
      `html,body{background:${pageBg} !important;background-attachment:fixed !important;}`,
      `body [class*="bg-background"]{background-color:transparent !important;}`,
    );
  }
  if (fontFamily) bridge.push(`body{font-family:${fontFamily};}`);
  if (accent) {
    bridge.push(
      `body::before{content:"";position:fixed;top:0;left:0;right:0;height:6px;z-index:9999;pointer-events:none;background:linear-gradient(90deg,${accent},${primary || accent},${accent});}`,
    );
  }

  return `${css}\n\n/* --- theme bridge (app tokens) --- */\n${bridge.join("\n")}`;
}

/**
 * Temporarily apply theme code to the real page (Theme Manager preview).
 * Returns a cleanup that restores the normal design.
 */
export function applyPreviewCode(code: ThemeCode): () => void {
  return applyThemeCode(code, {
    attr: "data-theme-preview",
    layerId: "site-theme-preview-layer",
    scriptAttr: "data-theme-preview-js",
  });
}

/** Back-compat: preview a legacy full-HTML theme. */
export function applyPreviewCss(html: string): () => void {
  return applyPreviewCode({ html });
}
