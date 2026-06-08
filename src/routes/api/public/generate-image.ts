import { createFileRoute } from "@tanstack/react-router";

// Kid-friendly safety wrapper: enforce safe, age-appropriate imagery.
const SYSTEM_GUIDE =
  "Child-safe, friendly cartoon/illustration style. Bright colors, cheerful, no violence, no scary themes, no realistic faces of real people, no text overlays. Subject: ";

export const Route = createFileRoute("/api/public/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: { prompt?: string; style?: string };
        try {
          body = (await request.json()) as { prompt?: string; style?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const raw = String(body.prompt || "").trim().slice(0, 400);
        const style = String(body.style || "cartoon").trim().slice(0, 40);
        if (!raw) return new Response("Prompt is required", { status: 400 });

        const fullPrompt = `${SYSTEM_GUIDE}${raw}. Style: ${style}, cute, child-friendly illustration, high quality.`;

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-image-2",
              prompt: fullPrompt,
              quality: "low",
              size: "1024x1024",
              n: 1,
              stream: true,
              partial_images: 2,
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          if (upstream.status === 429)
            return new Response("Too many requests — please wait a moment and try again.", { status: 429 });
          if (upstream.status === 402)
            return new Response("AI credits exhausted. Please ask the admin to top up.", { status: 402 });
          return new Response(text || "Image generation failed", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
