/**
 * Runs theme JavaScript inside a locked-down iframe (sandbox="allow-scripts",
 * no same-origin) so it can never touch the app's DOM, storage, cookies,
 * auth tokens or network session. The theme talks to the page only through a
 * small message API, and the parent applies those operations to theme regions.
 *
 * No eval / new Function is ever used in the main application context.
 */

export type ThemeOp =
  | { op: "css"; key: string; css: string }
  | { op: "html"; slot: string; html: string; mode: "replace" | "append" | "prepend" }
  | { op: "text"; slot: string; text: string }
  | { op: "remove"; slot: string }
  | { op: "bodyClass"; add: string[]; remove: string[] }
  | { op: "log"; args: unknown[] };

export type ThemeSandboxEvent =
  | { type: "route"; path: string }
  | { type: "click"; id: string | null; slot: string | null }
  | { type: "tick"; t: number };

const BOOTSTRAP = `
<!doctype html><meta charset="utf-8"><body>
<script>
(function(){
  var listeners = {};
  var cleanups = [];
  function send(msg){ parent.postMessage(Object.assign({ __theme: true }, msg), '*'); }
  var theme = {
    css: function(css, key){ send({ op:'css', css: String(css||''), key: String(key||'main') }); },
    html: function(slot, html, mode){ send({ op:'html', slot:String(slot||'floating'), html:String(html||''), mode: mode==='append'||mode==='prepend' ? mode : 'replace' }); },
    text: function(slot, text){ send({ op:'text', slot:String(slot||''), text:String(text==null?'':text) }); },
    remove: function(slot){ send({ op:'remove', slot:String(slot||'') }); },
    bodyClass: function(add, remove){ send({ op:'bodyClass', add:[].concat(add||[]).map(String), remove:[].concat(remove||[]).map(String) }); },
    log: function(){ send({ op:'log', args: Array.prototype.slice.call(arguments).map(function(a){ try { return JSON.parse(JSON.stringify(a)); } catch(e){ return String(a); } }) }); },
    on: function(type, cb){ (listeners[type] = listeners[type] || []).push(cb); },
    onCleanup: function(fn){ cleanups.push(fn); }
  };
  window.theme = theme;
  window.addEventListener('message', function(e){
    var d = e.data || {};
    if (d.__themeEvent === 'destroy') {
      cleanups.forEach(function(f){ try { f(); } catch(err){} });
      return;
    }
    if (!d.__themeEvent) return;
    (listeners[d.__themeEvent] || []).forEach(function(cb){ try { cb(d.payload); } catch(err){ theme.log('theme handler error: ' + err); } });
  });
  window.addEventListener('error', function(e){ theme.log('theme script error: ' + e.message); });
  try {
    /*__USER_CODE__*/
  } catch (err) { theme.log('theme script error: ' + err); }
})();
<\/script>
</body>`;

export type ThemeSandbox = {
  send: (event: ThemeSandboxEvent) => void;
  destroy: () => void;
};

export function createThemeSandbox(js: string, onOp: (op: ThemeOp) => void): ThemeSandbox {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("data-theme-sandbox", "1");
  iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px";
  iframe.srcdoc = BOOTSTRAP.replace("/*__USER_CODE__*/", js);

  const onMessage = (e: MessageEvent) => {
    if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
    const data = e.data as (ThemeOp & { __theme?: boolean }) | undefined;
    if (!data || data.__theme !== true || typeof data.op !== "string") return;
    try {
      onOp(data as ThemeOp);
    } catch (err) {
      console.error("[theme] op failed", err);
    }
  };
  window.addEventListener("message", onMessage);
  document.body.appendChild(iframe);

  let alive = true;
  return {
    send(event) {
      if (!alive) return;
      iframe.contentWindow?.postMessage(
        { __themeEvent: event.type, payload: event },
        "*",
      );
    },
    destroy() {
      if (!alive) return;
      alive = false;
      try {
        iframe.contentWindow?.postMessage({ __themeEvent: "destroy" }, "*");
      } catch {
        /* ignore */
      }
      window.removeEventListener("message", onMessage);
      setTimeout(() => iframe.remove(), 0);
    },
  };
}
