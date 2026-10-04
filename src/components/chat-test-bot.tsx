import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Send, CheckCheck, Loader2, MessageCircle } from "lucide-react";
import { curriculumHint, matchClass } from "@/lib/curriculum";
import { createQuickTest, specTitle, type QuickSpec } from "@/lib/quick-test";

type Msg =
  | { id: number; from: "me" | "bot"; text: string; time: string }
  | { id: number; from: "card"; spec: QuickSpec; time: string; state: "ready" | "busy" | "done"; testId?: string };

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
let seq = 1;

export function ChatTestBot() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: seq++,
      from: "bot",
      time: now(),
      text: 'Namaste! 🎓 Seedha likhiye, jaise: "Class 8 Science chapter 1 aur 2, topic Bacteria, 10 questions"',
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, thinking]);

  const push = (m: Omit<Msg, "id" | "time">) =>
    setMsgs((p) => [...p, { ...(m as Msg), id: seq++, time: now() }]);

  const generate = async (id: number) => {
    const card = msgs.find((m) => m.id === id);
    if (!card || card.from !== "card") return;
    setMsgs((p) => p.map((m) => (m.id === id ? { ...m, state: "busy" } as Msg : m)));
    try {
      const testId = await createQuickTest(card.spec);
      setMsgs((p) => p.map((m) => (m.id === id ? { ...m, state: "done", testId } as Msg : m)));
      push({ from: "bot", text: "✅ Test ban gaya! Neeche 'Open Test' dabakar dekh ya publish kar sakte hain." } as Msg);
      qc.invalidateQueries({ queryKey: ["tests"] });
    } catch (e) {
      setMsgs((p) => p.map((m) => (m.id === id ? { ...m, state: "ready" } as Msg : m)));
      push({ from: "bot", text: `❌ Test nahi ban paya: ${(e as Error).message.slice(0, 160)}` } as Msg);
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || thinking) return;
    setText("");
    push({ from: "me", text: t } as Msg);
    const pending = [...msgs].reverse().find((m) => m.from === "card" && m.state === "ready");
    if (pending && /^(yes|ok|haan|ha|han|thik|done|generate)\b/i.test(t)) {
      generate(pending.id);
      return;
    }
    setThinking(true);
    try {
      const cls = matchClass(t) || undefined;
      const res = await fetch("/api/public/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: t, catalogue: curriculumHint(cls) }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 160));
      const a = await res.json();
      if (a.action !== "create_test" || !a.student_class || !a.subject) {
        push({
          from: "bot",
          text: "🤔 Class aur subject samajh nahi aaya. Aise likhiye: \"Class 6 Maths chapter 1 aur 2, 15 questions\"",
        } as Msg);
        return;
      }
      const spec: QuickSpec = {
        student_class: a.student_class,
        subject: a.subject,
        chapter: a.chapter,
        topic: a.topic,
        count: a.count || 10,
        difficulty: a.difficulty || "medium",
        language: a.language || "en",
        time_limit_min: a.time_limit_min,
      };
      push({ from: "card", spec, state: "ready" } as Msg);
    } catch (e) {
      push({ from: "bot", text: `❌ Error: ${(e as Error).message}` } as Msg);
    } finally {
      setThinking(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
      >
        <MessageCircle className="size-4" /> Chat se test banayein
      </button>
    );

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border shadow-sm max-w-2xl">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <div className="grid size-9 place-items-center rounded-full bg-primary-foreground/20 font-bold">VA</div>
        <div className="flex-1">
          <div className="font-semibold leading-tight">Vertex Test Bot</div>
          <div className="text-xs opacity-80">{thinking ? "typing…" : "online"}</div>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs opacity-80 hover:opacity-100">Band karein</button>
      </div>

      <div className="h-80 space-y-2 overflow-y-auto bg-muted/60 p-3">
        {msgs.map((m) =>
          m.from === "card" ? (
            <div key={m.id} className="max-w-[85%] rounded-xl rounded-tl-none bg-card p-3 text-sm shadow-sm">
              <div className="font-semibold mb-1">📋 {specTitle(m.spec)}</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>• Class: {m.spec.student_class} | Subject: {m.spec.subject}</div>
                {m.spec.chapter && <div>• Chapter: {m.spec.chapter}</div>}
                {m.spec.topic && <div>• Topic: {m.spec.topic}</div>}
                <div>• {m.spec.count} MCQs ({m.spec.difficulty})</div>
              </div>
              <div className="mt-2">
                {m.state === "done" && m.testId ? (
                  <Link to="/teacher/tests/$id" params={{ id: m.testId }} className="inline-block rounded-lg bg-primary px-3 py-1.5 text-primary-foreground font-medium">
                    👁️ Open Test
                  </Link>
                ) : (
                  <button
                    disabled={m.state === "busy"}
                    onClick={() => generate(m.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-primary-foreground font-medium disabled:opacity-60"
                  >
                    {m.state === "busy" ? <><Loader2 className="size-4 animate-spin" /> Ban raha hai…</> : "⚡ Generate Now"}
                  </button>
                )}
              </div>
              <div className="mt-1 text-right text-[10px] text-muted-foreground">{m.time}</div>
            </div>
          ) : (
            <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                  m.from === "me" ? "rounded-tr-none bg-accent text-accent-foreground" : "rounded-tl-none bg-card"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  {m.time} {m.from === "me" && <CheckCheck className="size-3 text-primary" />}
                </div>
              </div>
            </div>
          ),
        )}
        {thinking && <div className="w-fit rounded-xl bg-card px-3 py-2 text-sm text-muted-foreground">AI likh raha hai… ✍️</div>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-border bg-card p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Class, subject, chapter, topic likhiye…"
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" disabled={thinking || !text.trim()} className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
