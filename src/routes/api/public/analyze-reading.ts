import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

type Analysis = {
  pronunciation_score: number; // 0..10
  fluency: "Poor" | "Average" | "Good" | "Excellent";
  reading_speed: "Slow" | "Normal" | "Fast";
  confidence: "Low" | "Medium" | "High";
  words_per_minute: number;
  common_mistakes: string[];
  improvement_tips: string[];
  overall_grade: "A" | "B" | "C" | "D";
  summary: string;
};

export const Route = createFileRoute("/api/public/analyze-reading")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const sarvamKey = process.env.SARVAM_API_KEY;
        const aiKey = process.env.LOVABLE_API_KEY;
        if (!sarvamKey || !aiKey) {
          return new Response(
            JSON.stringify({ error: "Missing API keys" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const inForm = await request.formData();
        const audio = inForm.get("audio");
        const language = String(inForm.get("language") || "en");
        const studentClass = String(inForm.get("student_class") || "");
        const bookName = String(inForm.get("book_name") || "");
        const durationSec = Number(inForm.get("duration_sec") || 0);

        if (!(audio instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 1) Speech-to-text via Sarvam
        const sttFd = new FormData();
        sttFd.append(
          "file",
          new File([audio], "reading.webm", { type: audio.type || "audio/webm" })
        );
        sttFd.append("model", "saarika:v2");
        sttFd.append("language_code", LANG_MAP[language] || "unknown");

        const sttResp = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: { "api-subscription-key": sarvamKey },
          body: sttFd,
        });
        if (!sttResp.ok) {
          const t = await sttResp.text();
          return new Response(
            JSON.stringify({ error: `STT ${sttResp.status}: ${t}` }),
            { status: sttResp.status, headers: { "Content-Type": "application/json" } }
          );
        }
        const sttData = (await sttResp.json()) as { transcript?: string };
        const transcript = (sttData.transcript || "").trim();

        const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
        const wpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 0;

        // 2) AI analysis (no book text, just transcript + meta)
        const system = `You are a kind primary-school reading coach. You evaluate a child's READ-ALOUD performance for Class ${studentClass} from a physical book titled "${bookName}".

You do NOT have the original book text. Judge ONLY from:
- the speech-to-text transcript (which captures pronunciation rough-cuts, hesitations, repetitions, filler words like "umm", "uhh", broken words, repeated words)
- the measured words-per-minute (WPM)
- the recording duration

Be lenient for Class 1-3, normal for Class 4-6, stricter for Class 7+.
Adjust expected WPM by class: Class 1-2 ~30-50, Class 3-5 ~60-100, Class 6-8 ~100-140, Class 9-12 ~140-180.

Return ONE tool call "submit_analysis" filling every field. Keep tips short, simple, child-friendly. Never reveal you are AI.`;

        const userPayload = `Class: ${studentClass}
Language: ${language}
Book: ${bookName}
Recording duration: ${durationSec} seconds
Measured speed: ${wpm} words/minute (transcript has ${wordCount} words)

Transcript:
"""${transcript || "(silent or unclear recording)"}"""`;

        const aiResp = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiKey}`,
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
                    name: "submit_analysis",
                    description: "Submit reading analysis report",
                    parameters: {
                      type: "object",
                      properties: {
                        pronunciation_score: { type: "number", minimum: 0, maximum: 10 },
                        fluency: { type: "string", enum: ["Poor", "Average", "Good", "Excellent"] },
                        reading_speed: { type: "string", enum: ["Slow", "Normal", "Fast"] },
                        confidence: { type: "string", enum: ["Low", "Medium", "High"] },
                        words_per_minute: { type: "number" },
                        common_mistakes: { type: "array", items: { type: "string" }, maxItems: 5 },
                        improvement_tips: { type: "array", items: { type: "string" }, maxItems: 5 },
                        overall_grade: { type: "string", enum: ["A", "B", "C", "D"] },
                        summary: { type: "string" },
                      },
                      required: [
                        "pronunciation_score",
                        "fluency",
                        "reading_speed",
                        "confidence",
                        "words_per_minute",
                        "common_mistakes",
                        "improvement_tips",
                        "overall_grade",
                        "summary",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "submit_analysis" } },
            }),
          }
        );

        if (!aiResp.ok) {
          if (aiResp.status === 429)
            return Response.json({ error: "Too many requests, please retry." }, { status: 429 });
          if (aiResp.status === 402)
            return Response.json({ error: "AI credits exhausted." }, { status: 402 });
          const t = await aiResp.text();
          return new Response(`AI error: ${aiResp.status} ${t}`, { status: aiResp.status });
        }

        const aiData = await aiResp.json();
        const call = aiData?.choices?.[0]?.message?.tool_calls?.[0];
        let analysis: Analysis | null = null;
        try {
          analysis = JSON.parse(call?.function?.arguments || "null");
        } catch {
          analysis = null;
        }

        if (!analysis) {
          return Response.json(
            { error: "Could not analyze recording. Please try again." },
            { status: 502 }
          );
        }

        // ensure measured wpm overrides hallucinated one
        analysis.words_per_minute = wpm;

        return Response.json({ transcript, word_count: wordCount, wpm, analysis });
      },
    },
  },
});
