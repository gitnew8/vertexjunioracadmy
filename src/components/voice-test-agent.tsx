import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { matchClass } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/custom-curriculum";
import { createQuickTest } from "@/lib/quick-test";

type Status = "idle" | "listening" | "thinking";

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hi-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

const PAGES: Record<string, string> = {
  tests: "/teacher/tests",
  fees: "/teacher/fees",
  students: "/teacher/students",
  materials: "/teacher/materials",
  reading: "/teacher/reading",
  live: "/teacher/live",
  reports: "/teacher/reports",
  dashboard: "/teacher/dashboard",
};

export function VoiceTestAgent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void process(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      };
      rec.start();
      recRef.current = rec;
      setHeard("");
      setStatus("listening");
    } catch {
      toast.error("Microphone ki permission dijiye");
    }
  }

  function stop() {
    recRef.current?.stop();
    recRef.current = null;
    setStatus("thinking");
  }

  async function process(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      fd.append("language", "hi");
      const sttRes = await fetch("/api/public/sarvam-stt", { method: "POST", body: fd });
      const stt = await sttRes.json();
      if (!sttRes.ok) throw new Error(stt.error || "Awaaz samajh nahi aayi");
      const transcript: string = stt.transcript || "";
      setHeard(transcript);
      if (!transcript) throw new Error("Kuch sunai nahi diya, dobara boliye");

      const cls = matchClass(transcript) || undefined;
      const cmdRes = await fetch("/api/public/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, catalogue: cur.hint(cls) }),
      });
      const cmd = await cmdRes.json();
      if (!cmdRes.ok) throw new Error(cmd.error || "AI command samajh nahi paya");

      if (cmd.action === "create_test") {
        if (!cmd.student_class || !cmd.subject) throw new Error("Class aur subject bataiye");
        const t = toast.loading("Test ban raha hai…");
        const id = await createQuickTest({
          student_class: cmd.student_class,
          subject: cmd.subject,
          chapter: cmd.chapter || null,
          topic: cmd.topic || null,
          count: Number(cmd.count) || 10,
          difficulty: cmd.difficulty || "medium",
          language: cmd.language || "en",
        });
        toast.success("Test tayyar!", { id: t });
        speak(cmd.say || "Aapka test tayyar hai");
        qc.invalidateQueries({ queryKey: ["tests"] });
        navigate({ to: "/teacher/tests/$id", params: { id } });
      } else if (cmd.action === "navigate" && cmd.page) {
        const path = PAGES[String(cmd.page).toLowerCase()] || String(cmd.page);
        speak(cmd.say || "Khol raha hoon");
        navigate({ to: path as "/teacher/tests" });
      } else {
        const msg = cmd.say || "Maaf kijiye, samajh nahi aaya. Jaise boliye: Class 6 Maths Integers ka 10 question test";
        toast.message(msg);
        speak(msg);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {(status !== "idle" || heard) && (
        <div className="max-w-xs rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
          {status === "listening" && <p className="font-medium">Sun raha hoon… boliye, phir rok dijiye</p>}
          {status === "thinking" && <p className="font-medium">Samajh raha hoon…</p>}
          {heard && <p className="text-muted-foreground mt-1">"{heard}"</p>}
        </div>
      )}
      <button
        aria-label={status === "listening" ? "Stop voice command" : "Start voice command"}
        onClick={status === "listening" ? stop : start}
        disabled={status === "thinking"}
        className={`size-14 rounded-full shadow-xl flex items-center justify-center text-primary-foreground transition ${
          status === "listening" ? "bg-destructive animate-pulse" : "bg-primary hover:scale-105"
        } disabled:opacity-70`}
      >
        {status === "thinking" ? (
          <Loader2 className="size-6 animate-spin" />
        ) : status === "listening" ? (
          <Square className="size-6" />
        ) : (
          <Mic className="size-6" />
        )}
      </button>
    </div>
  );
}
