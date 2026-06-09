import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Video, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/student/class/$code")({
  component: JoinClassPage,
  head: () => ({ meta: [{ title: "Join Live Class" }] }),
});

const SESSION_KEY = "student_session_v2";

type Session = { name: string; student_class: string; roll_number: string; login_number: string };
type LiveClass = {
  id: string; title: string; subject: string | null; student_class: string;
  room_code: string; teacher_name: string | null; status: string;
};

function JoinClassPage() {
  const { code } = useParams({ from: "/student/class/$code" });
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

  async function join() {
    if (!cls || !session) return;
    // get student id
    const { data: stu } = await supabase
      .from("students").select("id").eq("login_number", session.login_number).maybeSingle();
    const { data: att } = await supabase.from("class_attendance").insert({
      class_id: cls.id,
      student_id: stu?.id || null,
      student_name: session.name,
      student_class: session.student_class,
    }).select("id").maybeSingle();
    if (att) attendanceIdRef.current = att.id;
    setJoined(true);
  }

  // mark left_at on unload
  useEffect(() => {
    function handleLeave() {
      if (!attendanceIdRef.current) return;
      const payload = JSON.stringify({ left_at: new Date().toISOString() });
      // best-effort via fetch keepalive
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

  if (!session) {
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
          <Link to="/student" className="text-primary underline mt-3 inline-block">Back</Link>
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
          <Link to="/student" className="text-primary underline mt-3 inline-block">Back</Link>
        </div>
      </div>
    );
  }

  const jitsiUrl = `https://meet.jit.si/Vertex-${cls.room_code}#config.prejoinPageEnabled=false&userInfo.displayName=%22${encodeURIComponent(session.name)}%22`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/student" className="p-2 rounded-md hover:bg-secondary"><ArrowLeft className="size-4" /></Link>
          <div className="min-w-0">
            <div className="font-display font-semibold text-sm truncate flex items-center gap-2">
              <Video className="size-4 text-primary" /> {cls.title}
              {cls.status === "live" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-semibold animate-pulse">● LIVE</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Class {cls.student_class}{cls.subject ? ` · ${cls.subject}` : ""}{cls.teacher_name ? ` · ${cls.teacher_name}` : ""}
            </div>
          </div>
        </div>
      </header>

      {!joined ? (
        <main className="flex-1 grid place-items-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center">
            <Video className="size-12 mx-auto text-primary mb-3" />
            <h2 className="font-display text-xl font-semibold">Ready to join?</h2>
            <p className="text-sm text-muted-foreground mt-2">
              You'll join as <span className="font-medium text-foreground">{session.name}</span>.
              Allow camera & mic when asked.
            </p>
            {cls.status !== "live" && (
              <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Class hasn't started yet — you can wait inside.
              </div>
            )}
            <button
              onClick={join}
              className="mt-5 w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Join class
            </button>
            <p className="text-[11px] text-muted-foreground mt-3">
              Tip: Use Wi-Fi for best quality. Video adapts to your network automatically.
            </p>
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0">
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
            title="Live Class"
          />
        </main>
      )}
    </div>
  );
}
