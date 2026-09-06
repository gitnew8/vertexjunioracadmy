import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pageClasses, pickThemeForPath, type SiteTheme } from "@/lib/themes";
import { extractThemeCss, extractThemeMarkup, sanitizeThemeHtml } from "@/lib/theme-sanitize";
import { createThemeSandbox, type ThemeOp, type ThemeSandbox } from "@/lib/theme-sandbox";

export type ThemeCode = { css?: string | null; html?: string | null; js?: string | null };

const STYLE_ATTR = "data-site-theme";
const HTML_ID = "site-theme-layer";

/** CSS that makes region replacement possible without touching React trees. */
const BASE_CSS = `
[data-theme-region][data-theme-replaced] > :not([data-theme-injected]) { display: none !important; }
#${HTML_ID}, .site-theme-preview-layer { position: relative; z-index: 40; }
`;

/**
 * Applies the active theme's code (CSS + HTML + sandboxed JS) exactly as the
 * admin entered it. The React app keeps running underneath: theme markup is
 * mounted into stable `data-theme-region` containers, and theme JavaScript runs
 * in an isolated iframe that has no access to app data, tokens or storage.
 */
export function ThemeOverlay() {
  const [themes, setThemes] = useState<SiteTheme[] | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const handleRef = useRef<ThemeHandle | null>(null);

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
    document.body.setAttribute("data-theme-path", pathname);
    return () => document.body.classList.remove(...classes);
  }, [pathname]);

  useEffect(() => {
    if (!theme) return;
    const handle = applyThemeCode(theme, { attr: STYLE_ATTR, layerId: HTML_ID });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme?.id, theme?.updated_at, theme?.css, theme?.html, theme?.js]);

  // let theme JS react to navigation and re-mount markup on the new page
  useEffect(() => {
    handleRef.current?.onRoute?.(pathname);
  }, [pathname]);

  return null;
}

type ThemeHandle = (() => void) & { onRoute?: (path: string) => void };

/**
 * Injects theme code into the live document and returns a cleanup that fully
 * restores the original design.
 */
export function applyThemeCode(
  code: ThemeCode,
  opts: { attr: string; layerId: string; scriptAttr?: string },
): ThemeHandle {
  const rawCss = (code.css || "").trim();
  const css = rawCss || buildLiveThemeCss(code.html || "");
  const markup = sanitizeThemeHtml(extractThemeMarkup(code.html || ""));
  const js = (code.js || "").trim();

  document.querySelectorAll(`style[${opts.attr}]`).forEach((n) => n.remove());
  document.getElementById(opts.layerId)?.remove();

  const styles = new Map<string, HTMLStyleElement>();
  const setStyle = (key: string, text: string) => {
    let el = styles.get(key);
    if (!el) {
      el = document.createElement("style");
      el.setAttribute(opts.attr, key);
      document.head.appendChild(el);
      styles.set(key, el);
    }
    el.textContent = text; // stored & applied exactly as entered
  };

  setStyle("base", BASE_CSS);
  if (css) setStyle("main", css);

  const layer = document.createElement("div");
  layer.id = opts.layerId;
  layer.className = "site-theme-layer";
  layer.setAttribute("data-theme-injected", "1");
  document.body.appendChild(layer);

  const injected: Element[] = [];
  const replacedRegions = new Set<Element>();
  const addedBodyClasses = new Set<string>();

  const clearInjected = () => {
    injected.splice(0).forEach((n) => n.remove());
    replacedRegions.forEach((r) => r.removeAttribute("data-theme-replaced"));
    replacedRegions.clear();
    layer.innerHTML = "";
  };

  /** Mount one piece of markup into a named region (or the floating layer). */
  const mount = (slot: string, html: string, mode: "replace" | "append" | "prepend") => {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    const nodes = Array.from(holder.childNodes);
    const region =
      slot && slot !== "floating"
        ? document.querySelector(`[data-theme-region="${CSS.escape(slot)}"]`)
        : layer;
    if (!region) return;

    if (region !== layer && mode === "replace") {
      region.setAttribute("data-theme-replaced", "1");
      replacedRegions.add(region);
    }
    nodes.forEach((n) => {
      if (n instanceof Element) {
        n.setAttribute("data-theme-injected", "1");
        injected.push(n);
      }
      if (mode === "prepend") region.insertBefore(n, region.firstChild);
      else region.appendChild(n);
    });
  };

  /** Split authored markup into slots based on data-theme-slot attributes. */
  const mountAuthoredMarkup = () => {
    clearInjected();
    if (!markup) return;
    const holder = document.createElement("div");
    holder.innerHTML = markup;
    Array.from(holder.childNodes).forEach((node) => {
      if (!(node instanceof Element)) {
        if (node.textContent?.trim()) layer.appendChild(node);
        return;
      }
      const slot = node.getAttribute("data-theme-slot") || "floating";
      const modeAttr = node.getAttribute("data-theme-mode");
      const mode: "replace" | "append" | "prepend" =
        modeAttr === "append" || modeAttr === "prepend" ? modeAttr : "replace";
      mount(slot, node.outerHTML, slot === "floating" ? "append" : mode);
    });
  };

  mountAuthoredMarkup();

  // --- sandboxed theme JavaScript -----------------------------------------
  let sandbox: ThemeSandbox | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let onClick: ((e: MouseEvent) => void) | null = null;

  if (js) {
    const handleOp = (op: ThemeOp) => {
      switch (op.op) {
        case "css":
          setStyle(`js-${op.key}`, op.css);
          break;
        case "html":
          mount(op.slot, sanitizeThemeHtml(op.html), op.mode);
          break;
        case "text": {
          const el = document.querySelector(`[data-theme-region="${CSS.escape(op.slot)}"]`);
          if (el) el.textContent = op.text;
          break;
        }
        case "remove": {
          const region = document.querySelector(`[data-theme-region="${CSS.escape(op.slot)}"]`);
          region?.querySelectorAll("[data-theme-injected]").forEach((n) => n.remove());
          break;
        }
        case "bodyClass":
          op.add.forEach((c) => {
            document.body.classList.add(c);
            addedBodyClasses.add(c);
          });
          op.remove.forEach((c) => document.body.classList.remove(c));
          break;
        case "log":
          console.info("[theme]", ...op.args);
          break;
      }
    };

    sandbox = createThemeSandbox(js, handleOp);
    onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const node = target?.closest?.("[data-theme-id],[data-theme-region]") ?? null;
      sandbox?.send({
        type: "click",
        id: node?.getAttribute("data-theme-id") ?? null,
        slot: node?.getAttribute("data-theme-region") ?? null,
      });
    };
    document.addEventListener("click", onClick, true);
    tick = setInterval(() => sandbox?.send({ type: "tick", t: Date.now() }), 1000);
  }

  const cleanup = (() => {
    if (tick) clearInterval(tick);
    if (onClick) document.removeEventListener("click", onClick, true);
    sandbox?.destroy();
    clearInjected();
    layer.remove();
    styles.forEach((el) => el.remove());
    styles.clear();
    addedBodyClasses.forEach((c) => document.body.classList.remove(c));
  }) as ThemeHandle;

  cleanup.onRoute = (path: string) => {
    // re-mount markup for the newly rendered page, then notify theme JS
    requestAnimationFrame(() => {
      mountAuthoredMarkup();
      sandbox?.send({ type: "route", path });
    });
  };

  return cleanup;
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
  const css = extractThemeCss(html).replace(/@import[^;]*;/gi, "");
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
  });
}

/** Back-compat: preview a legacy full-HTML theme. */
export function applyPreviewCss(html: string): () => void {
  return applyPreviewCode({ html });
}

export { extractThemeCss };
