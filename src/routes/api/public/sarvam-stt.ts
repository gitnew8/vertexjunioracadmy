import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  hinglish: "unknown",
};

export const Route = createFileRoute("/api/public/sarvam-stt")({
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

        const inForm = await request.formData();
        const audio = inForm.get("audio") as unknown;
        const language = (inForm.get("language") as string) || "hinglish";
        if (!(audio instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }


        const fd = new FormData();
        const file = new File([audio], "audio.webm", {
          type: (audio as Blob).type || "audio/webm",
        });
        fd.append("file", file);

        fd.append("model", "saarika:v2.5");
        fd.append("language_code", LANG_MAP[language] || "unknown");

        const resp = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: { "api-subscription-key": key },
          body: fd,
        });

        if (!resp.ok) {
          const t = await resp.text();
          const isDeprecation = /deprecated|has been deprecated|please use|no longer supported/i.test(t);
          if (isDeprecation) {
            return new Response(
              JSON.stringify({
                error: "Speech-to-text model is no longer supported by the provider.",
                fix: "Ask your teacher or admin to update the STT model version in the backend code (e.g., switch to the latest model like saarika:v2.5).",
              }),
              { status: 502, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ error: `Sarvam STT ${resp.status}: ${t}` }),
            { status: resp.status, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = (await resp.json()) as {
          transcript?: string;
          language_code?: string;
        };
        return new Response(
          JSON.stringify({
            transcript: data.transcript || "",
            language_code: data.language_code || null,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
