import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft, Video, AlertCircle, Mic, MicOff, VideoOff, Hand, ScreenShare,
  PhoneOff, MessageSquare, NotebookPen, HelpCircle, Users, X, Send, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/student/class/$code")({
  component: JoinClassPage,
  validateSearch: (s: Record<string, unknown>) => ({
    role: (s.role === "teacher" ? "teacher" : "student") as "teacher" | "student",
    name: typeof s.name === "string" ? s.name : undefined,
  }),
  head: () => ({ meta: [{ title: "Live Class" }] }),
});

const SESSION_KEY = "student_session_v2";
const JITSI_SCRIPT = "https://meet.jit.si/external_api.js";

type Session = { name: string; student_class: string; roll_number: string; login_number: string };
type LiveClass = {
  id: string; title: string; subject: string | null; student_class: string;
  room_code: string; teacher_name: string | null; status: string;
};
type ChatMsg = { id: string; from: string; text: string; me?: boolean; ts: number };

declare global {
  interface Window { JitsiMeetExternalAPI?: any }
}

function loadJitsi(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
    const s = document.createElement("script");
    s.src = JITSI_SCRIPT;
    s.async = true;
    s.onload = () => resolve(window.JitsiMeetExternalAPI);
    s.onerror = () => reject(new Error("Failed to load Jitsi"));
    document.head.appendChild(s);
  });
}

function fmtTimer(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h > 0 ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function JoinClassPage() {
  const { code } = useParams({ from: "/student/class/$code" });
  const { role, name: nameOverride } = useSearch({ from: "/student/class/$code" });
  const isTeacher = role === "teacher";

  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cls, setCls] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const attendanceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) setSession(JSON.parse(raw) as Session);
    setHydrated(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("id,title,subject,student_class,room_code,teacher_name,status")
        .eq("room_code", code)
        .maybeSingle();
      if (error) toast.error(error.message);
      setCls(data as LiveClass | null);
      setLoading(false);
    })();
  }, [code]);

  const displayName = isTeacher
    ? (nameOverride || cls?.teacher_name || "Teacher")
    : (session?.name || nameOverride || "Student");

  async function join() {
    if (!cls) return;
    if (!isTeacher && session) {
      const { data: stu } = await supabase
        .from("students").select("id").eq("login_number", session.login_number).maybeSingle();
      const { data: att } = await supabase.from("class_attendance").insert({
        class_id: cls.id,
        student_id: stu?.id || null,
        student_name: session.name,
        student_class: session.student_class,
      }).select("id").maybeSingle();
      if (att) attendanceIdRef.current = att.id;
    }
    setJoined(true);
  }

  useEffect(() => {
    function handleLeave() {
      if (!attendanceIdRef.current) return;
      const payload = JSON.stringify({ left_at: new Date().toISOString() });
      try {
        navigator.sendBeacon?.(
          `https://bfhrytjatpvngmagpwjg.supabase.co/rest/v1/class_attendance?id=eq.${attendanceIdRef.current}`,
          new Blob([payload], { type: "application/json" })
        );
      } catch {}
    }
    window.addEventListener("pagehide", handleLeave);
    return () => window.removeEventListener("pagehide", handleLeave);
  }, []);

  if (!hydrated || loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  if (!isTeacher && !session) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm text-center">
          <AlertCircle className="size-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="font-display text-xl font-semibold">Login required</h1>
          <p className="text-sm text-muted-foreground mt-2">Please login as a student to join this class.</p>
          <Link to="/student" className="inline-block mt-4 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            Go to Student Login
          </Link>
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">Class not found</h1>
          <p className="text-sm text-muted-foreground mt-1">Check the link with your teacher.</p>
          <Link to={isTeacher ? "/teacher/classes" : "/student"} className="text-primary underline mt-3 inline-block">Back</Link>
        </div>
      </div>
    );
  }

  if (cls.status === "ended") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">Class has ended</h1>
          <p className="text-sm text-muted-foreground mt-1">{cls.title}</p>
          <Link to={isTeacher ? "/teacher/classes" : "/student"} className="text-primary underline mt-3 inline-block">Back</Link>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <Prejoin
        cls={cls}
        displayName={displayName}
        isTeacher={isTeacher}
        onJoin={join}
      />
    );
  }

  return <LiveRoom cls={cls} displayName={displayName} isTeacher={isTeacher} />;
}

function Prejoin({
  cls, displayName, isTeacher, onJoin,
}: { cls: LiveClass; displayName: string; isTeacher: boolean; onJoin: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 grid place-items-center p-6">
      <Toaster richColors position="top-center" />
      <div className="max-w-md w-full rounded-3xl bg-card border border-border shadow-xl p-7 text-center">
        <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 grid place-items-center shadow-lg">
          <Video className="size-8 text-white" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">{cls.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Class {cls.student_class}{cls.subject ? ` · ${cls.subject}` : ""}
          {cls.teacher_name ? ` · ${cls.teacher_name}` : ""}
        </p>
        {cls.status === "live" && (
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE NOW
          </div>
        )}
        <div className="mt-6 rounded-xl bg-muted/50 p-4 text-left text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Joining as</span><span className="font-medium">{displayName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium">{isTeacher ? "Teacher (host)" : "Student"}</span></div>
          {!isTeacher && (
            <div className="flex justify-between"><span className="text-muted-foreground">Mic</span><span className="font-medium">Off by default</span></div>
          )}
        </div>
        <button
          onClick={onJoin}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white py-3 text-sm font-semibold shadow-md hover:opacity-90 transition"
        >
          One-tap join
        </button>
        <Link to={isTeacher ? "/teacher/classes" : "/student"} className="inline-block mt-3 text-xs text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>
    </div>
  );
}

function LiveRoom({
  cls, displayName, isTeacher,
}: { cls: LiveClass; displayName: string; isTeacher: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [micOn, setMicOn] = useState(false); // students start off
  const [camOn, setCamOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState<"chat" | "notes" | "doubts">("chat");
  const [panelOpen, setPanelOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [doubts, setDoubts] = useState<ChatMsg[]>([]);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [participants, setParticipants] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let api: any;
    (async () => {
      const JitsiAPI = await loadJitsi();
      if (cancelled || !containerRef.current) return;
      api = new JitsiAPI("meet.jit.si", {
        roomName: `Vertex-${cls.room_code}`,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: !isTeacher,
          startWithVideoMuted: true,
          disableDeepLinking: true,
          toolbarButtons: [], // hide default toolbar
          hideConferenceSubject: true,
          hideConferenceTimer: true,
          disableTileView: false,
          notifications: [],
          disableInviteFunctions: true,
          readOnlyName: true,
          enableClosePage: false,
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DISABLE_VIDEO_BACKGROUND: false,
          TOOLBAR_BUTTONS: [],
          SETTINGS_SECTIONS: [],
        },
      });
      apiRef.current = api;

      api.addListener("videoConferenceJoined", () => setReady(true));
      api.addListener("audioMuteStatusChanged", (e: any) => setMicOn(!e.muted));
      api.addListener("videoMuteStatusChanged", (e: any) => setCamOn(!e.muted));
      api.addListener("screenSharingStatusChanged", (e: any) => setSharing(!!e.on));
      api.addListener("raiseHandUpdated", (e: any) => {
        // only reflect our own
        try {
          const me = api.getParticipantsInfo?.().find((p: any) => p.displayName === displayName);
          if (me && e.id === me.participantId) setHandRaised(!!e.handRaised);
        } catch {}
      });
      const updateCount = () => {
        try { setParticipants(api.getNumberOfParticipants?.() || 1); } catch {}
      };
      api.addListener("participantJoined", updateCount);
      api.addListener("participantLeft", updateCount);
      api.addListener("videoConferenceJoined", updateCount);
      api.addListener("incomingMessage", (e: any) => {
        setChat((c) => [...c, { id: `${Date.now()}-${Math.random()}`, from: e.nick || "Someone", text: e.message, ts: Date.now() }]);
      });
      api.addListener("readyToClose", () => { window.history.back(); });
    })();
    return () => {
      cancelled = true;
      try { apiRef.current?.dispose?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = useCallback(() => apiRef.current?.executeCommand("toggleAudio"), []);
  const toggleCam = useCallback(() => apiRef.current?.executeCommand("toggleVideo"), []);
  const toggleShare = useCallback(() => apiRef.current?.executeCommand("toggleShareScreen"), []);
  const toggleHand = useCallback(() => apiRef.current?.executeCommand("toggleRaiseHand"), []);
  const leave = useCallback(() => {
    try { apiRef.current?.executeCommand("hangup"); } catch {}
    window.history.back();
  }, []);
  const muteAll = useCallback(() => {
    try { apiRef.current?.executeCommand("muteEveryone"); toast.success("Muted everyone"); } catch {}
  }, []);

  function sendChat() {
    const text = msg.trim();
    if (!text) return;
    if (tab === "doubts") {
      setDoubts((d) => [...d, { id: `${Date.now()}`, from: displayName, text, me: true, ts: Date.now() }]);
      try { apiRef.current?.executeCommand("sendChatMessage", `❓ Doubt: ${text}`); } catch {}
    } else {
      setChat((c) => [...c, { id: `${Date.now()}`, from: displayName, text, me: true, ts: Date.now() }]);
      try { apiRef.current?.executeCommand("sendChatMessage", text); } catch {}
    }
    setMsg("");
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white overflow-hidden">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="shrink-0 h-14 px-3 sm:px-4 flex items-center justify-between gap-3 bg-slate-900/80 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={leave} className="p-2 rounded-lg hover:bg-white/10 shrink-0" aria-label="Back">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-semibold text-sm sm:text-base truncate">{cls.title}</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
            </div>
            <div className="text-[11px] text-white/60 truncate">
              {cls.teacher_name || "Teacher"} · Class {cls.student_class}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/70">
            <Users className="size-3.5" /> {participants}
          </div>
          <div className="font-mono text-xs px-2 py-1 rounded-md bg-white/10 tabular-nums">{fmtTimer(elapsed)}</div>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 min-h-0 flex">
        {/* Video */}
        <div className="flex-1 min-w-0 relative bg-black">
          <div ref={containerRef} className="absolute inset-0" />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950">
              <div className="text-center">
                <div className="mx-auto size-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <p className="mt-3 text-sm text-white/70">Connecting to class…</p>
              </div>
            </div>
          )}
        </div>

        {/* Side panel (desktop) */}
        <aside className={`hidden md:flex w-80 shrink-0 border-l border-white/5 bg-slate-900/70 flex-col`}>
          <SidePanel
            tab={tab} setTab={setTab}
            chat={chat} doubts={doubts} notes={notes} setNotes={setNotes}
            msg={msg} setMsg={setMsg} sendChat={sendChat}
          />
        </aside>
      </div>

      {/* Mobile side panel drawer */}
      {panelOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setPanelOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-slate-900 border-l border-white/10 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-3 flex items-center justify-between border-b border-white/10">
              <span className="text-sm font-semibold">Panel</span>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 rounded hover:bg-white/10"><X className="size-4" /></button>
            </div>
            <SidePanel
              tab={tab} setTab={setTab}
              chat={chat} doubts={doubts} notes={notes} setNotes={setNotes}
              msg={msg} setMsg={setMsg} sendChat={sendChat}
            />
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <footer className="shrink-0 bg-slate-900/95 backdrop-blur border-t border-white/5 px-2 sm:px-4 py-2.5">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
          <CtrlBtn
            onClick={toggleMic}
            active={micOn}
            label={micOn ? "Mic" : "Muted"}
            icon={micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
            danger={!micOn}
          />
          <CtrlBtn
            onClick={toggleCam}
            active={camOn}
            label={camOn ? "Camera" : "Camera"}
            icon={camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            danger={!camOn}
          />
          <CtrlBtn
            onClick={toggleHand}
            active={handRaised}
            label="Raise"
            icon={<Hand className="size-5" />}
            accent={handRaised}
          />
          {(isTeacher || true) && (
            <CtrlBtn
              onClick={toggleShare}
              active={sharing}
              label="Share"
              icon={<ScreenShare className="size-5" />}
              accent={sharing}
            />
          )}
          <CtrlBtn
            onClick={() => setPanelOpen(true)}
            label="Chat"
            icon={<MessageSquare className="size-5" />}
            mobileOnly
          />
          {isTeacher && (
            <CtrlBtn
              onClick={muteAll}
              label="Mute all"
              icon={<MicOff className="size-5" />}
            />
          )}
          <button
            onClick={leave}
            className="inline-flex flex-col items-center gap-0.5 px-3 sm:px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-900/30"
            aria-label="Leave"
          >
            <PhoneOff className="size-5" />
            <span className="text-[10px] font-semibold">Leave</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function CtrlBtn({
  onClick, icon, label, active, danger, accent, mobileOnly,
}: {
  onClick: () => void; icon: React.ReactNode; label: string;
  active?: boolean; danger?: boolean; accent?: boolean; mobileOnly?: boolean;
}) {
  const base = "inline-flex flex-col items-center gap-0.5 px-3 sm:px-4 py-2 rounded-xl transition min-w-[56px]";
  const style = danger
    ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
    : accent
    ? "bg-amber-400/20 text-amber-200 hover:bg-amber-400/30"
    : active
    ? "bg-white/15 text-white hover:bg-white/20"
    : "bg-white/5 text-white/80 hover:bg-white/10";
  return (
    <button
      onClick={onClick}
      className={`${base} ${style} ${mobileOnly ? "md:hidden" : ""}`}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function SidePanel({
  tab, setTab, chat, doubts, notes, setNotes, msg, setMsg, sendChat,
}: {
  tab: "chat" | "notes" | "doubts";
  setTab: (t: "chat" | "notes" | "doubts") => void;
  chat: ChatMsg[]; doubts: ChatMsg[];
  notes: string; setNotes: (v: string) => void;
  msg: string; setMsg: (v: string) => void;
  sendChat: () => void;
}) {
  const list = tab === "doubts" ? doubts : chat;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="grid grid-cols-3 border-b border-white/10 text-xs">
        {[
          { k: "chat", label: "Chat", icon: <MessageSquare className="size-3.5" /> },
          { k: "notes", label: "Notes", icon: <NotebookPen className="size-3.5" /> },
          { k: "doubts", label: "Doubts", icon: <HelpCircle className="size-3.5" /> },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`py-2.5 flex items-center justify-center gap-1.5 font-medium border-b-2 transition ${
              tab === t.k ? "border-sky-400 text-white" : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "notes" ? (
        <div className="flex-1 min-h-0 flex flex-col p-3">
          <div className="flex items-center gap-1.5 text-xs text-white/60 mb-2">
            <Sparkles className="size-3.5" /> Private notes — saved on this device
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Type your class notes here…"
            className="flex-1 min-h-0 w-full resize-none rounded-lg bg-white/5 border border-white/10 p-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {list.length === 0 ? (
              <div className="text-center text-xs text-white/40 mt-8">
                {tab === "doubts" ? "Ask your first doubt — teacher will see it." : "No messages yet."}
              </div>
            ) : (
              list.map((m) => (
                <div key={m.id} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.me ? "bg-sky-600 text-white" : "bg-white/10 text-white"
                  }`}>
                    {!m.me && <div className="text-[10px] font-semibold text-white/70 mb-0.5">{m.from}</div>}
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-white/10 p-2 flex items-center gap-2">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder={tab === "doubts" ? "Type a doubt…" : "Message everyone…"}
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <button
              onClick={sendChat}
              className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 transition"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
