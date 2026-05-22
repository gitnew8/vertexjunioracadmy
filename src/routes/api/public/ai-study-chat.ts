import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

type ImageAttachment = { kind: "image"; dataUrl: string; name?: string };
type FileAttachment = { kind: "file"; name: string; text: string };
type Attachment = ImageAttachment | FileAttachment;

type ChatMsg = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
};

type Body = {
  messages: ChatMsg[];
  student_class?: string;
  subject?: string;
  mode?: string;
  language?: "en" | "hi" | "hinglish";
};

const MODE_HINTS: Record<string, string> = {
  explain: "Explain the topic clearly with simple examples, in step-by-step bullet points.",
  solve: "Solve the question step-by-step. Show every step. End with a clear final answer.",
  mcq: "Generate 10 multiple choice questions with 4 options each (A-D) and mark the correct answer with explanation.",
  notes: "Create concise, well-organized revision notes with headings, bullet points, and key formulas.",
  homework: "Help with homework: give hints first, then the full solution, then a similar practice question.",
  file: "Answer ONLY from the uploaded file content provided. If the answer is not in the file, say so politely.",
  image: "Read the text/diagram in the image, then explain or solve it step-by-step.",
  test: "Create a short practice test (5 MCQ + 3 short answer) with answer key at the end.",
};

function buildSystemPrompt(b: Body): string {
  const cls = b.student_class || "school";
  const sub = b.subject || "general";
  const mode = b.mode || "explain";
  const lang =
    b.language === "hi"
      ? "Reply in simple Hindi (Devanagari)."
      : b.language === "hinglish"
      ? "Reply in Hinglish — easy Hindi written in English script, mixed with simple English where natural."
      : "Reply in simple English. If the student writes in Hindi or Hinglish, match their language.";

  return `You are a kind, patient school teacher helping a Class ${cls} student with ${sub}.

${lang}

Rules:
- Keep language simple and age-appropriate for Class ${cls}.
- Use short sentences, bullets, examples, and step-by-step reasoning.
- Never say "I am an AI". Speak as a friendly teacher ("Beta", "Let's see together").
- Never give harmful, adult, or off-syllabus content. If asked, gently redirect to studies.
- Do not encourage cheating. For homework, give a hint first, then the solution.
- Use Markdown: **bold** for key terms, bullets for steps, tables when comparing.
- For math, write formulas plainly (e.g. x^2 + 2x + 1). Do not use LaTeX.

Current mode: ${mode.toUpperCase()} — ${MODE_HINTS[mode] || MODE_HINTS.explain}`;
}

function buildUserContent(msg: ChatMsg): unknown {
  const parts: unknown[] = [];
  let textBlock = msg.content || "";
  const fileTexts = (msg.attachments || []).filter(
    (a): a is FileAttachment => a.kind === "file"
  );
  if (fileTexts.length) {
    const joined = fileTexts
      .map(
        (f) =>
          `--- FILE: ${f.name} ---\n${f.text.slice(0, 60000)}${
            f.text.length > 60000 ? "\n…(truncated)" : ""
          }`
      )
      .join("\n\n");
    textBlock = `${textBlock}\n\n${joined}`.trim();
  }
  if (textBlock) parts.push({ type: "text", text: textBlock });
  for (const a of msg.attachments || []) {
    if (a.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    }
  }
  return parts.length === 1 && (parts[0] as { type: string }).type === "text"
    ? (parts[0] as { type: "text"; text: string }).text
    : parts;
}

export const Route = createFileRoute("/api/public/ai-study-chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as Body;
        if (!body?.messages?.length) {
          return new Response("Invalid input", { status: 400 });
        }

        const hasImage = body.messages.some((m) =>
          m.attachments?.some((a) => a.kind === "image")
        );
        const model = hasImage
          ? "google/gemini-2.5-pro"
          : "google/gemini-2.5-flash";

        const apiMessages = [
          { role: "system", content: buildSystemPrompt(body) },
          ...body.messages.map((m) => ({
            role: m.role,
            content:
              m.role === "user" ? buildUserContent(m) : (m.content || ""),
          })),
        ];

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: apiMessages,
              stream: true,
            }),
          }
        );

        if (!upstream.ok) {
          if (upstream.status === 429) {
            return new Response(
              JSON.stringify({
                error: "Too many requests. Please wait a moment and try again.",
              }),
              { status: 429, headers: { "Content-Type": "application/json" } }
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({
                error:
                  "AI credits exhausted. Please add funds to your Lovable workspace.",
              }),
              { status: 402, headers: { "Content-Type": "application/json" } }
            );
          }
          const t = await upstream.text();
          return new Response(`AI error: ${upstream.status} ${t}`, {
            status: upstream.status,
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  },
});
