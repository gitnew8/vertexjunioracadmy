/**
 * Sanitizes theme markup before it is mounted into the live app.
 * Themes may bring any visual markup (layout, cards, images, svg, canvas…)
 * but never executable code or anything that could read app data.
 */
const FORBIDDEN = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "FRAME",
  "FRAMESET",
  "BASE",
  "META",
  "FORM",
]);

export function sanitizeThemeHtml(html: string): string {
  if (!html || typeof document === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div id="__t">${html}</div>`, "text/html");
  const root = doc.getElementById("__t");
  if (!root) return "";

  root.querySelectorAll("*").forEach((el) => {
    if (FORBIDDEN.has(el.tagName)) {
      el.remove();
      return;
    }
    if (el.tagName === "LINK") {
      const rel = (el.getAttribute("rel") || "").toLowerCase();
      if (rel !== "stylesheet" && rel !== "preconnect") el.remove();
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = (attr.value || "").trim();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "href" || name === "src" || name === "xlink:href" || name === "action") &&
        /^\s*(javascript|data:text\/html|vbscript)/i.test(value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return root.innerHTML;
}

/** Pull only CSS out of a full uploaded HTML document. */
export function extractThemeCss(html: string): string {
  if (!html) return "";
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) blocks.push(m[1]);
  if (!blocks.length && !/<[a-z!/]/i.test(html)) blocks.push(html); // plain CSS file
  return blocks.join("\n").replace(/<\/?script[\s\S]*?>/gi, "").trim();
}

/** Strip <style>/<script> from pasted markup so only visible structure remains. */
export function extractThemeMarkup(html: string): string {
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
