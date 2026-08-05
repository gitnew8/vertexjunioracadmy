import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

/**
 * Vision OCR + object detection for LKG/UKG worksheets.
 * Input: one page image (data URL or https URL) + class level.
 * Output: questions + normalised hotspot boxes (0..1 of page width/height).
 * The original paper is never modified — we only return coordinates.
 */

type Body = {
  image?: string;
  student_class?: string;
  page_index?: number;
};

const TOOL = {
  type: "function",
  function: {
    name: "submit_worksheet",
    description: "Return detected questions and clickable hotspot boxes for the worksheet page.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "short unique id like q1, q2" },
              no: { type: "number" },
              type: {
                type: "string",
                enum: [
                  "count_choose",
                  "click_picture",
                  "click_number",
                  "tick_box",
                  "tick_less",
                  "tick_more",
                  "match",
                  "drag_drop",
                  "missing_number",
                  "alphabet",
                  "shapes",
                  "colours",
                  "fruits",
                  "animals",
                  "body_parts",
                  "rhyming",
                  "opposites",
                  "evs",
                ],
              },
              prompt: { type: "string", description: "Short spoken instruction for a 4-5 year old" },
              topic: { type: "string" },
            },
            required: ["key", "no", "type", "prompt", "topic"],
            additionalProperties: false,
          },
        },
        hotspots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              group_key: { type: "string", description: "question key this belongs to" },
              kind: { type: "string", enum: ["tap", "drag", "target"] },
              label: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
              is_correct: { type: "boolean" },
              match_key: { type: "string" },
            },
            required: ["group_key", "kind", "label", "x", "y", "w", "h", "is_correct"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions", "hotspots"],
      additionalProperties: false,
    },
  },
};

export const Route = createFileRoute("/api/public/analyze-paper")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const image = String(body.image || "");
        if (!image) return Response.json({ error: "image is required" }, { status: 400 });
        const level = String(body.student_class || "LKG");

        const system = `You are an OCR + object-detection engine for pre-school (${level}) printed worksheets in India.
Analyse the page image and detect EVERY question, sub-question, picture, number, letter, option box, blank box and matching item.

Rules:
- Coordinates must be NORMALISED floats 0..1 relative to the full page image (x,y = top-left corner, w,h = size). Be tight around each object.
- One hotspot per tappable object/option/picture/number/box. Never one giant box.
- For each question mark exactly the correct option(s) with is_correct=true; all other options false.
- For matching / drag & drop questions: left-side objects get kind="drag", right-side objects get kind="target", and a matched pair shares the SAME match_key (e.g. "p1").
- prompt must be a very short spoken instruction a 4-5 year old understands, e.g. "Count the ducks and touch the correct number." Keep it under 12 words.
- If you cannot read the answer confidently, still emit the hotspots and mark your best guess correct — the teacher verifies before publishing.
- Do not invent objects that are not visible.`;

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: [
                  { type: "text", text: `Analyse this ${level} worksheet page and return questions + hotspots.` },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
            tools: [TOOL],
            tool_choice: { type: "function", function: { name: "submit_worksheet" } },
          }),
        });

        if (!resp.ok) {
          if (resp.status === 429)
            return Response.json({ error: "Too many requests, please retry in a minute." }, { status: 429 });
          if (resp.status === 402)
            return Response.json({ error: "AI credits exhausted. Please top up to continue." }, { status: 402 });
          const t = await resp.text();
          return Response.json({ error: `AI ${resp.status}: ${t}` }, { status: resp.status });
        }

        const data = await resp.json();
        const call = data?.choices?.[0]?.message?.tool_calls?.[0];
        try {
          const out = JSON.parse(call?.function?.arguments || "null");
          if (!out) throw new Error("empty");
          const clamp = (n: unknown) => Math.max(0, Math.min(1, Number(n) || 0));
          const hotspots = (out.hotspots || [])
            .map((h: Record<string, unknown>) => ({
              group_key: String(h.group_key || "q1"),
              kind: h.kind === "drag" || h.kind === "target" ? h.kind : "tap",
              label: String(h.label || ""),
              x: clamp(h.x),
              y: clamp(h.y),
              w: Math.max(0.02, clamp(h.w)),
              h: Math.max(0.02, clamp(h.h)),
              is_correct: Boolean(h.is_correct),
              match_key: h.match_key ? String(h.match_key) : null,
            }))
            .filter((h: { w: number; h: number }) => h.w > 0.01 && h.h > 0.01);
          return Response.json({ questions: out.questions || [], hotspots });
        } catch {
          return Response.json({ error: "Could not analyse this page. Try a clearer scan." }, { status: 502 });
        }
      },
    },
  },
});
