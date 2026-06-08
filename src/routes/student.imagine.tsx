import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { ArrowLeft, Sparkles, Download, Loader2, Wand2, RefreshCw } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/student/imagine")({
  component: ImaginePage,
  head: () => ({ meta: [{ title: "Imagine — AI Art for Kids" }] }),
});

type Style = { id: string; label: string; emoji: string };
const STYLES: Style[] = [
  { id: "cartoon", label: "Cartoon", emoji: "🎨" },
  { id: "watercolor", label: "Watercolor", emoji: "💧" },
  { id: "crayon", label: "Crayon", emoji: "🖍️" },
  { id: "3d clay", label: "3D Clay", emoji: "🧸" },
  { id: "pixel art", label: "Pixel", emoji: "👾" },
  { id: "storybook illustration", label: "Storybook", emoji: "📖" },
];

const IDEAS = [
  "A friendly dragon reading a book under a tree",
  "A cat astronaut floating in space with planets",
  "A jungle with happy elephants and rainbow birds",
  "A robot baking cupcakes in a kitchen",
  "An underwater school of smiling fish in a coral city",
  "A castle made of candy on a fluffy cloud",
];

function ImaginePage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("cartoon");
  const [src, setSrc] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function generate() {
    const p = prompt.trim();
    if (!p) {
      toast.error("Type what you want to imagine!");
      return;
    }
    setBusy(true);
    setSrc(null);
    setIsFinal(false);

    try {
      const res = await fetch("/api/public/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, style }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Failed (${res.status})`);
      }

      let sawCompleted = false;
      const parser = createParser({
        onEvent(event) {
          if (
            event.event !== "image_generation.partial_image" &&
            event.event !== "image_generation.completed"
          )
            return;
          let payload: { b64_json?: string };
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }
          if (!payload.b64_json) return;
          const final = event.event === "image_generation.completed";
          flushSync(() => {
            setSrc(`data:image/png;base64,${payload.b64_json}`);
            if (final) setIsFinal(true);
          });
          if (final) sawCompleted = true;
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(value);
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      if (!sawCompleted) throw new Error("Image stream ended without a final image");
      toast.success("Your picture is ready! 🎉");
    } catch (e: any) {
      toast.error(e?.message || "Could not create the image");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `imagine-${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-sky-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between">
          <Link to="/student" className="inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="font-display font-semibold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Imagine
          </div>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            Make your own ✨ AI picture
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tell the computer what to draw and watch the magic happen!
          </p>
        </div>

        <div className="mt-6 rounded-3xl border-2 border-border bg-card p-5 shadow-xl">
          <label className="text-sm font-semibold">What should we draw?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
            disabled={busy}
            rows={3}
            placeholder="e.g. A happy puppy flying a kite on the beach"
            className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:border-primary"
          />
          <div className="mt-1 text-[11px] text-muted-foreground text-right">
            {prompt.length}/400
          </div>

          <div className="mt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Need ideas?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((i) => (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  onClick={() => setPrompt(i)}
                  className="text-xs rounded-full border border-border bg-background hover:bg-secondary px-3 py-1.5"
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Pick a style</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  onClick={() => setStyle(s.id)}
                  className={`rounded-xl border-2 px-2 py-3 text-xs font-medium transition ${
                    style === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <div className="text-2xl">{s.emoji}</div>
                  <div className="mt-1">{s.label}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={busy || !prompt.trim()}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-primary to-sky-500 text-white px-5 py-4 text-base font-bold shadow-lg hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            {busy ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Creating your magic…
              </>
            ) : (
              <>
                <Wand2 className="size-5" /> Generate Picture
              </>
            )}
          </button>
        </div>

        <div className="mt-6">
          {src ? (
            <div className="rounded-3xl border-2 border-border bg-card p-3 shadow-xl">
              <div className="relative rounded-2xl overflow-hidden bg-secondary aspect-square">
                <img
                  src={src}
                  alt="AI generated"
                  className={`w-full h-full object-cover transition-[filter] duration-500 ${
                    isFinal ? "blur-0" : "blur-2xl"
                  }`}
                />
                {!isFinal && (
                  <div className="absolute inset-0 grid place-items-center bg-black/20">
                    <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 shadow">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      Painting…
                    </div>
                  </div>
                )}
              </div>
              {isFinal && (
                <div className="mt-3 flex gap-2 flex-wrap justify-center">
                  <button
                    onClick={download}
                    className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90"
                  >
                    <Download className="size-4" /> Save Picture
                  </button>
                  <button
                    onClick={generate}
                    disabled={busy}
                    className="rounded-xl border-2 border-border bg-background px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 hover:bg-secondary"
                  >
                    <RefreshCw className="size-4" /> Try again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
              <div className="text-5xl">🎨</div>
              <p className="mt-3 text-sm text-muted-foreground">
                Your picture will appear here. Type an idea and tap Generate!
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Pictures are made by AI · Always be kind and safe with what you ask 💛
        </p>
      </main>
    </div>
  );
}
