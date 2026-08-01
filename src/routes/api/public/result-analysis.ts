import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Item = {
  q_no: number;
  question: string;
  section: string;
  difficulty?: string | null;
  topic?: string | null;
  correct: boolean;
  attempted: boolean;
  your_answer: string;
  correct_answer: string;
};

type Body = {
  student_class: string;
  subject: string;
  test_title: string;
  percentage: number;
  accuracy: number;
  items: Item[];
};

export const Route = createFileRoute("/api/public/result-analysis")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });

        const body = (await request.json()) as Body;
        const items = (body.items || []).slice(0, 120);
        if (!items.length) return Response.json({ error: "No questions" }, { status: 400 });

        const system = `You are an exam performance analyst for Indian school students (${body.student_class}, subject: ${body.subject}). Analyse the attempt data and produce an honest, encouraging report. Use simple English mixed with easy Hindi words where helpful. Base every point strictly on the given data.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: `Test: ${body.test_title}\nPercentage: ${body.percentage}%\nAccuracy: ${body.accuracy}%\nQuestions:\n${JSON.stringify(items)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_analysis",
                  description: "Return the performance analysis",
                  parameters: {
                    type: "object",
                    properties: {
                      strong_topics: { type: "array", items: { type: "string" } },
                      weak_topics: { type: "array", items: { type: "string" } },
                      common_mistakes: { type: "array", items: { type: "string" } },
                      suggestions: { type: "array", items: { type: "string" } },
                      recommended_chapters: { type: "array", items: { type: "string" } },
                      recommended_practice: { type: "array", items: { type: "string" } },
                      readiness_percent: { type: "number", minimum: 0, maximum: 100 },
                      summary: { type: "string" },
                    },
                    required: [
                      "strong_topics",
                      "weak_topics",
                      "common_mistakes",
                      "suggestions",
                      "recommended_chapters",
                      "recommended_practice",
                      "readiness_percent",
                      "summary",
                    ],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "submit_analysis" } },
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
        try {
          const out = JSON.parse(call?.function?.arguments || "null");
          if (!out) throw new Error("empty");
          return Response.json(out);
        } catch {
          return Response.json({ error: "Could not generate analysis" }, { status: 502 });
        }
      },
    },
  },
});
