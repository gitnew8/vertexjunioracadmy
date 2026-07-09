import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

// Groq Whisper STT — replaces old Sarvam STT (kept same route path for
// backward compatibility with existing client code).
const LANG_MAP: Record<string, string> = {
  en: "en",
  hi: "hi",
  hinglish: "hi", // treat Hinglish as Hindi for Whisper
};

export const Route = createFileRoute("/api/public/sarvam-stt")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.GROQ_API_KEY;
        if (!key) {
          return new Response(
            JSON.stringify({ error: "GROQ_API_KEY not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const inForm = await request.formData();
        const audio = inForm.get("audio") as unknown;
        const language = (inForm.get("language") as string) || "hi";
        if (!(audio instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const mime = (audio as Blob).type || "audio/webm";
        const ext =
          ({
            "audio/webm": "webm",
            "audio/mp4": "mp4",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
            "audio/wave": "wav",
            "audio/ogg": "ogg",
          } as Record<string, string>)[mime.split(";")[0]] || "webm";

        const fd = new FormData();
        fd.append("file", new File([audio], `audio.${ext}`, { type: mime }));
        fd.append("model", "whisper-large-v3");
        fd.append("language", LANG_MAP[language] || "hi");
        fd.append("response_format", "json");
        fd.append("temperature", "0");

        const resp = await fetch(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: fd,
          }
        );

        if (!resp.ok) {
          const t = await resp.text();
          return new Response(
            JSON.stringify({ error: `Groq STT ${resp.status}: ${t}` }),
            { status: resp.status, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = (await resp.json()) as { text?: string; language?: string };
        return new Response(
          JSON.stringify({
            transcript: (data.text || "").trim(),
            language_code: data.language || LANG_MAP[language] || "hi",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
