import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  ChevronLeft,
  Loader2,
  X,
  FileText,
  Bot,
  GraduationCap,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromFile, fileToImageDataUrl } from "@/lib/file-extract";

export const Route = createFileRoute("/student/ai")({
  component: AiHelperPage,
  head: () => ({ meta: [{ title: "AI Study Helper" }] }),
});

const SESSION_KEY = "student_session_v2";

type StudentSession = {
  name: string;
  student_class: string;
  roll_number: string;
  login_number: string;
};

type Attachment =
  | { kind: "image"; dataUrl: string; name?: string }
  | { kind: "file"; name: string; text: string };

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

type SessionRow = {
  id: string;
  title: string;
  mode: string;
  subject: string | null;
  student_class: string | null;
  updated_at: string;
};

const MODES: { key: string; label: string; emoji: string }[] = [
  { key: "explain", label: "Explain Topic", emoji: "📖" },
  { key: "solve", label: "Solve Question", emoji: "🧮" },
  { key: "mcq", label: "MCQ Practice", emoji: "✅" },
  { key: "notes", label: "Revision Notes", emoji: "📝" },
  { key: "homework", label: "Homework Help", emoji: "🎒" },
  { key: "file", label: "From File", emoji: "📎" },
  { key: "image", label: "From Image", emoji: "📷" },
  { key: "test", label: "Test Prep", emoji: "🧪" },
];

const CLASSES = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];

const SUBJECTS = [
  "Math", "Science", "Physics", "Chemistry", "Biology",
  "English", "Hindi", "Social Science", "History", "Geography",
  "Computer", "GK",
];

function AiHelperPage() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<StudentSession | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const [input, setInput] = useState("");
  const [pendingAtts, setPendingAtts] = useState<Attachment[]>([]);
  const [mode, setMode] = useState<string>("explain");
  const [studentClass, setStudentClass] = useState("");
  const [subject, setSubject] = useState<string>("Math");
  const [language, setLanguage] = useState<"en" | "hi" | "hinglish">("hinglish");

  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [transcribing, setTranscribing] = useState(false);


  // Hydrate session
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as StudentSession;
      setSession(s);
      setStudentClass(s.student_class || "");
    }
    setHydrated(true);
  }, []);

  // Resolve student row id
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (data?.id) setStudentId(data.id);
    })();
  }, [session]);

  // Load sessions list
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title, mode, subject, student_class, updated_at")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(50);
      setSessions((data || []) as SessionRow[]);
    })();
  }, [studentId]);

  // Load messages when session changes
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content, attachments")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: true });
      const msgs: ChatMsg[] = (data || []).map((m) => ({
        id: m.id as string,
        role: m.role as "user" | "assistant",
        content: m.content as string,
        attachments: (m.attachments as Attachment[]) || [],
      }));
      setMessages(msgs);
    })();
  }, [currentSessionId]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function newChat() {
    setCurrentSessionId(null);
    setMessages([]);
    setPendingAtts([]);
    setInput("");
    setSidebarOpen(false);
  }

  async function deleteSession(id: string) {
    await supabase.from("chat_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) newChat();
  }

  async function clearCurrentChat() {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    await supabase.from("chat_messages").delete().eq("session_id", currentSessionId);
    setMessages([]);
  }

  async function ensureSession(firstUserText: string): Promise<string | null> {
    if (currentSessionId) return currentSessionId;
    if (!studentId) {
      toast.error("Loading your account, try again in a second…");
      return null;
    }
    const title = firstUserText.slice(0, 60) || "New chat";
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        student_id: studentId,
        title,
        mode,
        subject,
        student_class: studentClass,
      })
      .select("id, title, mode, subject, student_class, updated_at")
      .single();
    if (error || !data) {
      toast.error("Could not start chat: " + (error?.message || "unknown"));
      return null;
    }
    setCurrentSessionId(data.id as string);
    setSessions((prev) => [data as SessionRow, ...prev]);
    return data.id as string;
  }

  // ---- File / image upload handlers ----
  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploadingFile(true);
    try {
      const res = await extractTextFromFile(f);
      if (!res.text.trim()) {
        toast.error("Could not extract text from this file.");
        return;
      }
      setPendingAtts((prev) => [
        ...prev,
        { kind: "file", name: res.name, text: res.text },
      ]);
      setMode("file");
      toast.success(`Loaded "${res.name}"${res.pages ? ` · ${res.pages} pages` : ""}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please pick an image file.");
      return;
    }
    try {
      const dataUrl = await fileToImageDataUrl(f);
      setPendingAtts((prev) => [...prev, { kind: "image", dataUrl, name: f.name }]);
      setMode("image");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function removePendingAtt(idx: number) {
    setPendingAtts((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- Voice (Sarvam STT via MediaRecorder) ----
  async function toggleListening() {
    if (listening) {
      try {
        recorderRef.current?.stop();
      } catch {
        /* noop */
      }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setListening(false);
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        const blob = new Blob(recChunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        if (blob.size < 800) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "speech.webm");
          fd.append("language", language);
          const resp = await fetch("/api/public/sarvam-stt", {
            method: "POST",
            body: fd,
          });
          const data = (await resp.json()) as {
            transcript?: string;
            error?: string;
          };
          if (!resp.ok) {
            toast.error(data.error || "Voice failed");
            return;
          }
          if (data.transcript) {
            setInput((prev) => (prev ? prev + " " : "") + data.transcript);
          } else {
            toast.message("Couldn't hear anything, try again.");
          }
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err) {
      toast.error("Mic permission denied: " + (err as Error).message);
    }
  }

  async function speak(text: string) {
    if (!ttsOn) return;
    try {
      const resp = await fetch("/api/public/sarvam-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      const data = (await resp.json()) as { audios?: string[]; error?: string };
      if (!resp.ok || !data.audios?.length) {
        if (data.error) console.warn("TTS:", data.error);
        return;
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      // play chunks sequentially
      const playOne = (b64: string) =>
        new Promise<void>((resolve) => {
          const audio = new Audio(`data:audio/wav;base64,${b64}`);
          audioElRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      for (const a of data.audios) {
        await playOne(a);
      }
    } catch {
      /* noop */
    }
  }


  // ---- Send message + stream ----
  async function send() {
    const text = input.trim();
    if (!text && pendingAtts.length === 0) return;
    if (!studentClass) {
      toast.error("Please pick your class first.");
      return;
    }
    if (sending) return;

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || (pendingAtts.some((a) => a.kind === "image")
        ? "Please read this image and help me."
        : "Please explain this file."),
      attachments: pendingAtts,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setPendingAtts([]);
    setSending(true);

    const sessId = await ensureSession(userMsg.content);
    if (!sessId) {
      setSending(false);
      return;
    }

    // persist user message (without huge image base64 if too big? keep as-is)
    await supabase.from("chat_messages").insert({
      session_id: sessId,
      role: "user",
      content: userMsg.content,
      attachments: JSON.parse(JSON.stringify(userMsg.attachments || [])),
    });

    // assistant placeholder
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    let acc = "";
    try {
      const resp = await fetch("/api/public/ai-study-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          student_class: studentClass,
          subject,
          mode,
          language,
        }),
      });

      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        let msg = "Sorry, something went wrong.";
        try {
          const j = JSON.parse(t);
          if (j.error) msg = j.error;
        } catch {
          if (t) msg = t;
        }
        acc = msg;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m))
        );
      } else {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let done = false;
        while (!done) {
          const { value, done: d } = await reader.read();
          if (d) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") { done = true; break; }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                acc += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
                );
              }
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
      }

      // persist assistant message
      await supabase.from("chat_messages").insert({
        session_id: sessId,
        role: "assistant",
        content: acc,
      });
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessId);

      if (acc) speak(acc);
    } catch (err) {
      const msg = (err as Error).message || "Network error";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m))
      );
    } finally {
      setSending(false);
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const currentTitle = useMemo(() => {
    if (!currentSessionId) return "New chat";
    return sessions.find((s) => s.id === currentSessionId)?.title || "Chat";
  }, [currentSessionId, sessions]);

  if (!hydrated) {
    return <main className="p-10 text-sm text-muted-foreground">Loading…</main>;
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-muted-foreground mb-3">Please login first.</p>
        <button
          onClick={() => navigate({ to: "/student" })}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          Go to login
        </button>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-background to-secondary/30">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/student" })}
            className="p-1.5 rounded-lg hover:bg-secondary"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center shadow-md">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-semibold truncate">AI Study Helper</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {currentTitle} · {session.name}
            </div>
          </div>
          <button
            onClick={() => setTtsOn((v) => !v)}
            className={`p-2 rounded-lg border border-border ${
              ttsOn ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            }`}
            title={ttsOn ? "Voice reply on" : "Voice reply off"}
          >
            {ttsOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg border border-border hover:bg-secondary md:hidden"
          >
            <GraduationCap className="size-4" />
          </button>
        </div>

        {/* Class / subject / language / mode */}
        <div className="mx-auto max-w-5xl px-4 pb-3 flex flex-wrap gap-2 items-center">
          <select
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5"
          >
            <option value="">Class…</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
            {studentClass && !CLASSES.includes(studentClass) && (
              <option value={studentClass}>Class {studentClass}</option>
            )}
          </select>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "hi" | "hinglish")}
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5"
          >
            <option value="hinglish">Hinglish</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={clearCurrentChat}
            className="text-xs inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 hover:bg-secondary"
          >
            <Trash2 className="size-3.5" /> Clear
          </button>
        </div>

        {/* Mode tabs */}
        <div className="border-t border-border bg-background">
          <div className="mx-auto max-w-5xl px-2 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${
                  mode === m.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-background hover:bg-secondary"
                }`}
              >
                <span className="mr-1">{m.emoji}</span>{m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-5xl flex overflow-hidden">
        {/* Sidebar (history) */}
        <aside
          className={`${
            sidebarOpen ? "absolute inset-0 z-30 bg-background" : "hidden"
          } md:relative md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-background/60`}
        >
          <div className="p-3 flex items-center gap-2 border-b border-border">
            <button
              onClick={newChat}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90"
            >
              <Plus className="size-4" /> New chat
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg border border-border"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3">No previous chats.</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group rounded-lg px-2 py-2 flex items-center gap-2 cursor-pointer ${
                    currentSessionId === s.id ? "bg-secondary" : "hover:bg-secondary/60"
                  }`}
                  onClick={() => {
                    setCurrentSessionId(s.id);
                    setSidebarOpen(false);
                  }}
                >
                  <Bot className="size-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{s.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {s.subject || "—"} · Class {s.student_class || "?"} · {s.mode}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <section className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.length === 0 ? (
              <EmptyState onPick={(p) => setInput(p)} />
            ) : (
              messages.map((m) => <MessageBubble key={m.id} msg={m} />)
            )}
            {sending && messages[messages.length - 1]?.role === "assistant" &&
              !messages[messages.length - 1]?.content && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Teacher is thinking…
                </div>
              )}
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-background/90 backdrop-blur px-3 py-3">
            {pendingAtts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAtts.map((a, i) => (
                  <div
                    key={i}
                    className="relative rounded-lg border border-border bg-secondary/50 p-1.5 pr-7 flex items-center gap-2 text-xs"
                  >
                    {a.kind === "image" ? (
                      <img src={a.dataUrl} alt="" className="size-10 object-cover rounded" />
                    ) : (
                      <FileText className="size-4 text-primary" />
                    )}
                    <span className="max-w-[160px] truncate">
                      {a.kind === "image" ? a.name || "photo" : a.name}
                    </span>
                    <button
                      onClick={() => removePendingAtt(i)}
                      className="absolute top-1 right-1 p-0.5 rounded hover:bg-background"
                      aria-label="Remove"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.docx"
                className="hidden"
                onChange={handleFilePick}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImagePick}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary disabled:opacity-50"
                title="Upload PDF / DOCX / TXT"
              >
                {uploadingFile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary"
                title="Upload photo"
              >
                <ImageIcon className="size-4" />
              </button>
              <button
                onClick={toggleListening}
                className={`p-2.5 rounded-xl border ${
                  listening
                    ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                    : "border-border bg-background hover:bg-secondary"
                }`}
                title="Voice input"
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKey}
                rows={1}
                placeholder={
                  listening
                    ? "Listening…"
                    : mode === "image"
                    ? "Ask about the photo…"
                    : mode === "file"
                    ? "Ask from the file…"
                    : "Type your question (Hindi / English)…"
                }
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-40"
              />
              <button
                onClick={send}
                disabled={sending || (!input.trim() && pendingAtts.length === 0)}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground text-center">
              Tip: switch mode above, attach a photo of a question, or upload a chapter PDF.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "Photosynthesis ko easy words me samjhao",
    "Solve: 2x + 5 = 17, find x",
    "Make 5 MCQs on Light chapter",
    "Notes banao on French Revolution",
  ];
  return (
    <div className="text-center py-10">
      <div className="size-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center shadow-lg">
        <Sparkles className="size-7" />
      </div>
      <h2 className="font-display text-2xl font-semibold mt-4">
        Hi! Main tumhara AI teacher hoon 👋
      </h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Koi bhi question pucho, photo bhejo, ya PDF upload karo. Main step-by-step samjhaunga.
      </p>
      <div className="mt-6 grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left text-sm rounded-xl border border-border bg-card hover:bg-secondary px-3 py-2.5"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center">
          <Sparkles className="size-4" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm"
        }`}
      >
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {msg.attachments.map((a, i) =>
              a.kind === "image" ? (
                <img
                  key={i}
                  src={a.dataUrl}
                  alt=""
                  className="max-h-48 rounded-lg border border-border"
                />
              ) : (
                <div
                  key={i}
                  className={`inline-flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 ${
                    isUser ? "bg-primary-foreground/20" : "bg-secondary"
                  }`}
                >
                  <FileText className="size-3.5" /> {a.name}
                </div>
              )
            )}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5">
            <ReactMarkdown>{msg.content || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
