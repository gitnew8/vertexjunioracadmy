import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Body = {
  passage: string;
  language?: "en" | "hi";
  student_class?: string;
  count?: number;
};

type MCQ = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};

export const Route = createFileRoute("/api/public/reading-quiz")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
        }
        const body = (await request.json()) as Body;
        const passage = (body.passage || "").trim().slice(0, 6000);
        const language = body.language === "hi" ? "hi" : "en";
        const count = Math.min(5, Math.max(1, body.count ?? 3));
        const studentClass = body.student_class || "Class 5";

        if (!passage) {
          return Response.json({ error: "Empty passage" }, { status: 400 });
        }

        const system = `You are a school reading-comprehension coach for ${studentClass}. Generate ${count} SIMPLE multiple-choice questions strictly from the passage below. Language of the questions and options MUST be ${language === "hi" ? "Hindi (Devanagari)" : "English"}. Keep vocabulary age-appropriate. Each MCQ has exactly 4 options with only one correct. Provide a one-line explanation quoting or referring to the passage.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: system },
              { role: "user", content: `Passage:\n"""${passage}"""` },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_quiz",
                  description: "Return MCQs generated from the passage",
                  parameters: {
                    type: "object",
                    properties: {
                      questions: {
                        type: "array",
                        minItems: 1,
                        maxItems: 5,
                        items: {
                          type: "object",
                          properties: {
                            question: { type: "string" },
                            options: {
                              type: "array",
                              minItems: 4,
                              maxItems: 4,
                              items: { type: "string" },
                            },
                            answer_index: { type: "number", minimum: 0, maximum: 3 },
                            explanation: { type: "string" },
                          },
                          required: ["question", "options", "answer_index", "explanation"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["questions"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "submit_quiz" } },
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
        let out: { questions: MCQ[] } | null = null;
        try {
          out = JSON.parse(call?.function?.arguments || "null");
        } catch {
          out = null;
        }
        if (!out?.questions?.length) {
          return Response.json({ error: "Could not generate quiz" }, { status: 502 });
        }
        return Response.json({ questions: out.questions });
      },
    },
  },
});
