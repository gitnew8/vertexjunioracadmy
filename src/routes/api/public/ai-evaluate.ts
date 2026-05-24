import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type Item = {
  q_no: number;
  question: string;
  section: string;
  marks: number;
  student_answer: string;
};

type Body = {
  subject?: string;
  student_class?: string;
  items: Item[];
};

type Eval = {
  q_no: number;
  verdict: "Correct" | "Partial" | "Wrong";
  marks: number;
  feedback: string;
};

export const Route = createFileRoute("/api/public/ai-evaluate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as Body;
        if (!body?.items?.length) {
          return Response.json({ evaluations: [] });
        }

        const system = `You are an intelligent, fair school examiner for Class ${body.student_class || "school"} ${body.subject || ""}.

Rules:
- Do NOT rely on any pre-saved or fixed answer key.
- Read each QUESTION carefully and understand what is being asked.
- Read the STUDENT'S ANSWER and judge it by MEANING and CONCEPT, not exact wording.
- Different correct wordings, examples, or order are fully allowed.
- Decide correctness based on: concept clarity, logic, relevance, and examples.
- Fully correct → award FULL marks.
- Partially correct → award PARTIAL marks (any value between 0 and max, in 0.5 steps allowed).
- Wrong or blank → 0 marks and briefly explain the correct concept.
- Feedback must be 2-3 short student-friendly lines, simple language.
- Never reveal you are an AI. Speak like a kind teacher.

You will receive a list of questions with the student's answers and the maximum marks for each.
Return ONE tool call "submit_evaluations" with an array of evaluations — one per question, same q_no.`;

        const userPayload = body.items
          .map(
            (it) =>
              `Q${it.q_no} [${it.section}, max ${it.marks} marks]
Question: ${it.question}
Student answer: ${it.student_answer || "(not answered)"}`
          )
          .join("\n\n");

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: system },
                { role: "user", content: userPayload },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "submit_evaluations",
                    description: "Submit per-question evaluations",
                    parameters: {
                      type: "object",
                      properties: {
                        evaluations: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              q_no: { type: "number" },
                              verdict: {
                                type: "string",
                                enum: ["Correct", "Partial", "Wrong"],
                              },
                              marks: { type: "number" },
                              feedback: { type: "string" },
                            },
                            required: ["q_no", "verdict", "marks", "feedback"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["evaluations"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "submit_evaluations" },
              },
            }),
          }
        );

        if (!upstream.ok) {
          if (upstream.status === 429) {
            return Response.json(
              { error: "Too many requests. Please wait and try again." },
              { status: 429 }
            );
          }
          if (upstream.status === 402) {
            return Response.json(
              { error: "AI credits exhausted." },
              { status: 402 }
            );
          }
          const t = await upstream.text();
          return new Response(`AI error: ${upstream.status} ${t}`, {
            status: upstream.status,
          });
        }

        const data = await upstream.json();
        const call = data?.choices?.[0]?.message?.tool_calls?.[0];
        let evaluations: Eval[] = [];
        try {
          const args = JSON.parse(call?.function?.arguments || "{}");
          evaluations = (args.evaluations || []) as Eval[];
        } catch {
          evaluations = [];
        }

        // Clamp marks to [0, max] per question
        const maxByQ = new Map(body.items.map((i) => [i.q_no, i.marks]));
        evaluations = evaluations.map((e) => {
          const max = maxByQ.get(e.q_no) ?? 0;
          const m = Math.max(0, Math.min(max, Number(e.marks) || 0));
          return { ...e, marks: m };
        });

        return Response.json({ evaluations });
      },
    },
  },
});
