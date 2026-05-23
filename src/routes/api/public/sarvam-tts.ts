import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  text: string;
  language?: "en" | "hi" | "hinglish";
  speaker?: string;
};

const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  hinglish: "hi-IN",
};

export const Route = createFileRoute("/api/public/sarvam-tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.SARVAM_API_KEY;
        if (!key) {
          return new Response(
            JSON.stringify({ error: "SARVAM_API_KEY not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const body = (await request.json()) as Body;
        const text = (body.text || "")
          .replace(/[*_`#>]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1500);
        if (!text) {
          return new Response(JSON.stringify({ error: "Empty text" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const target = LANG_MAP[body.language || "hinglish"] || "hi-IN";
        const speaker = body.speaker || "anushka";

        // Sarvam allows up to 500 chars per input — chunk by sentence.
        const chunks: string[] = [];
        let cur = "";
        for (const part of text.split(/(?<=[.!?।])\s+/)) {
          if ((cur + " " + part).trim().length > 480) {
            if (cur) chunks.push(cur.trim());
            cur = part;
          } else {
            cur = (cur + " " + part).trim();
          }
        }
        if (cur) chunks.push(cur);

        const resp = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "api-subscription-key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: chunks,
            target_language_code: target,
            speaker,
            model: "bulbul:v2",
            speech_sample_rate: 22050,
            enable_preprocessing: true,
          }),
        });

        if (!resp.ok) {
          const t = await resp.text();
          return new Response(
            JSON.stringify({ error: `Sarvam TTS ${resp.status}: ${t}` }),
            { status: resp.status, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = (await resp.json()) as { audios?: string[] };
        const audios = data.audios || [];
        if (!audios.length) {
          return new Response(JSON.stringify({ error: "No audio returned" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ audios }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
