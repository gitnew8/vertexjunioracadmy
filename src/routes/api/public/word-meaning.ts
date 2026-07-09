import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  word: string;
  context?: string;
  source_language?: "en" | "hi";
};

export const Route = createFileRoute("/api/public/word-meaning")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
        }
        const body = (await request.json()) as Body;
        const word = (body.word || "").trim().slice(0, 60);
        const context = (body.context || "").trim().slice(0, 500);
        const src = body.source_language === "hi" ? "hi" : "en";
        if (!word) return Response.json({ error: "Empty word" }, { status: 400 });

        const system = `You are a school dictionary assistant for Indian students. Given a word (possibly in ${
          src === "hi" ? "Hindi" : "English"
        }) and its sentence context, return a simple Hindi meaning, a short easy definition (in simple Hindi), and one example sentence using the word. Keep it child-friendly. Never refuse.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: `Word: "${word}"\nContext: "${context || "(none)"}"`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_meaning",
                  description: "Return meaning of the word",
                  parameters: {
                    type: "object",
                    properties: {
                      hindi_meaning: { type: "string" },
                      definition: { type: "string" },
                      example: { type: "string" },
                      part_of_speech: { type: "string" },
                    },
                    required: ["hindi_meaning", "definition", "example"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "submit_meaning" } },
          }),
        });

        if (!resp.ok) {
          if (resp.status === 429) return Response.json({ error: "Too many requests" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "AI credits exhausted" }, { status: 402 });
          const t = await resp.text();
          return Response.json({ error: `AI ${resp.status}: ${t}` }, { status: resp.status });
        }
        const data = await resp.json();
        const call = data?.choices?.[0]?.message?.tool_calls?.[0];
        let out: {
          hindi_meaning: string;
          definition: string;
          example: string;
          part_of_speech?: string;
        } | null = null;
        try {
          out = JSON.parse(call?.function?.arguments || "null");
        } catch {
          out = null;
        }
        if (!out) return Response.json({ error: "No meaning" }, { status: 502 });
        return Response.json(out);
      },
    },
  },
});
