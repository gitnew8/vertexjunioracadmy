import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  transcript: string;
  catalogue?: string;
};

const SYSTEM = `You convert an Indian school teacher's spoken command (Hindi, English or Hinglish) into a strict JSON action for a school app.

Allowed actions:
- "create_test": teacher wants a test / question paper / quiz generated.
- "navigate": teacher wants to open a page.
- "unknown": anything else.

Return ONLY JSON of this shape:
{
  "action": "create_test" | "navigate" | "unknown",
  "student_class": "LKG" | "UKG" | "Class 1" ... "Class 10" | null,
  "subject": "Maths" | "Science" | "English" | "Hindi" | "EVS" | "SST" | "GK" | "Computer" | null,
  "chapter": string | null,
  "topic": string | null,
  "count": number | null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "language": "en" | "hi" | "bilingual" | null,
  "time_limit_min": number | null,
  "page": "dashboard" | "tests" | "students" | "fees" | "materials" | "reading" | "live" | "reports" | "rewards" | null,
  "say": "one short friendly Hinglish confirmation sentence"
}

Pick the chapter name from the provided catalogue when it is close to what the teacher said. No markdown, no prose.`;

export const Route = createFileRoute("/api/public/voice-command")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key)
          return new Response(JSON.stringify({ error: "AI not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });

        const body = (await request.json()) as Body;
        const transcript = (body?.transcript || "").trim();
        if (!transcript)
          return new Response(JSON.stringify({ error: "Empty transcript" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });

        const userText = `Teacher said: """${transcript}"""

Chapter catalogue (use these exact chapter names when relevant):
${body.catalogue || "(not provided)"}`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            store: false,
            stream: true,
            reasoning: { effort: "low" },
            text: { format: { type: "json_object" } },
            input: [
              { role: "system", content: [{ type: "input_text", text: SYSTEM }] },
              { role: "user", content: [{ type: "input_text", text: userText }] },
            ],
          }),
        });

        if (!resp.ok || !resp.body) {
          const t = await resp.text().catch(() => "");
          return new Response(
            JSON.stringify({ error: `AI error ${resp.status}: ${t.slice(0, 300)}` }),
            { status: resp.status || 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // Accumulate the SSE stream server-side; the client only needs the final JSON.
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() || "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const evt = JSON.parse(payload) as {
                  type?: string;
                  delta?: string;
                  text?: string;
                };
                if (evt.type === "response.output_text.delta" && typeof evt.delta === "string")
                  text += evt.delta;
                else if (evt.type === "response.output_text.done" && !text && evt.text)
                  text = evt.text;
              } catch {
                /* ignore partial frame */
              }
            }
          }
        }

        let parsed: Record<string, unknown> = { action: "unknown" };
        try {
          parsed = JSON.parse(text);
        } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              parsed = JSON.parse(m[0]);
            } catch {
              /* keep unknown */
            }
          }
        }

        return new Response(JSON.stringify({ ...parsed, transcript }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
