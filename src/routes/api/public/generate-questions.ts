import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type QType = "MCQ" | "TrueFalse" | "OneWord" | "Short";

type GenInput = {
  student_class: string;
  subject: string;
  chapter?: string;
  count: number;
  types: QType[];
  difficulty: "easy" | "medium" | "hard";
  language: "en" | "hi" | "bilingual";
  prompt?: string;
};

const LANG_LABEL: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bilingual: "Bilingual (Hindi + English)",
};

export const Route = createFileRoute("/api/public/generate-questions")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as GenInput;
        if (!body || !body.subject || !body.student_class || !body.count || !body.types?.length) {
          return new Response("Invalid input", { status: 400 });
        }

        const sys = `You are an experienced Indian school exam paper setter. Generate high-quality, syllabus-aligned, non-repeating exam questions following CBSE/State board pattern. Respond ONLY with valid JSON.`;

        const promptBlock = body.prompt?.trim()
          ? `\n\nTEACHER'S CUSTOM INSTRUCTIONS (highest priority — follow these exactly):\n"""\n${body.prompt.trim()}\n"""\n`
          : "";

        const user = `Create ${body.count} exam questions for:
- Class: ${body.student_class}
- Subject: ${body.subject}
- Chapter/Topic: ${body.chapter || "General"}
- Question types allowed: ${body.types.join(", ")}
- Difficulty: ${body.difficulty}
- Language: ${LANG_LABEL[body.language]}${promptBlock}

Distribute questions across the allowed types. For MCQ, provide exactly 4 options A/B/C/D and put the correct option letter (A/B/C/D) as correct_answer. For TrueFalse, correct_answer must be "True" or "False". For OneWord and Short, give the model answer as correct_answer.

Return JSON in this exact shape:
{
  "questions": [
    {
      "section": "MCQ" | "TrueFalse" | "OneWord" | "Short",
      "question": "string",
      "options": ["A. ...","B. ...","C. ...","D. ..."] | null,
      "correct_answer": "string",
      "marks": 1,
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

No prose. No markdown fences. Only JSON.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          return new Response(`AI error: ${resp.status} ${text}`, { status: resp.status });
        }

        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content ?? "{}";
        let parsed: { questions: unknown[] } = { questions: [] };
        try {
          parsed = JSON.parse(content);
        } catch {
          // try to extract JSON block
          const m = content.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        }
        return Response.json(parsed);
      },
    },
  },
});
