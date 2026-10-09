import { SyllabusCoordinatorCard } from "@/components/syllabus-coordinator-card";
import { LeaderboardWidget } from "@/components/leaderboard";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ReportRow } from "@/lib/types";
import { GraduationCap, LogOut, Calendar, ExternalLink, Copy, Download, Receipt, BookOpen, Eye, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { generateReceiptPdf } from "@/lib/receipt";
import { toast, Toaster } from "sonner";
import { RewardProgressCard } from "@/components/reward-progress-card";
import { TermsModal } from "@/components/terms-modal";
import { checkAndAwardRewards } from "@/lib/rewards";

export const Route = createFileRoute("/student")({
  component: StudentPage,
  head: () => ({ meta: [{ title: "Student Login — Vertex Junior Academy" }] }),
});

const SESSION_KEY = "student_session_v2";

type Session = { name: string; student_class: string; roll_number: string; login_number: string };

type StudentTest = {
  id: string;
  title: string;
  subject: string;
  chapter: string | null;
  time_limit_min: number;
  total_marks: number;
  is_free: boolean | null;
  price: number | null;
  discount_price: number | null;
};

function generateLoginNumber() {
  // 6-digit number, leading zeros allowed
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
}

function MyVisualWorksheets({ session }: { session: Session }) {
  const [rows, setRows] = useState<{ id: string; title: string; subject: string; student_class: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("visual_papers")
        .select("id,title,subject,student_class")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      const norm = (v: string) => (v || "").toLowerCase().replace(/^class\s*/, "").trim();
      const want = norm(session.student_class || "");
      // "UKG 1" student also sees plain "UKG" worksheets (section suffix ignored)
      const wantBase = want.replace(/\s*\d+$/, "").trim();
      setRows(
        (data || []).filter((r) => {
          const c = norm(r.student_class);
          return c === want || (!!wantBase && wantBase !== want && c === wantBase);
        }),
      );
    })();
  }, [session.student_class]);

  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display font-semibold mb-3">🎨 Fun Worksheets</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            to="/student/visual/$id"
            params={{ id: r.id }}
            search={{ preview: false }}
            className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-secondary"
          >
            <span className="text-2xl">🧸</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium truncate">{r.title}</span>
              <span className="block text-xs text-muted-foreground">
                {r.student_class} · {r.subject} · tap to answer
              </span>
            </span>
            <span className="text-xs font-semibold text-primary">Start ▶</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MyTests({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [attemptsById, setAttemptsById] = useState<Record<string, { score: number; total: number }>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: stu } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      const { data: ts } = await supabase
        .from("tests")
        .select("id, title, subject, chapter, time_limit_min, total_marks, is_free, price, discount_price")
        .eq("student_class", session.student_class)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setTests((ts || []) as StudentTest[]);
      if (stu && ts?.length) {
        const { data: at } = await supabase
          .from("test_attempts")
          .select("test_id, score, total")
          .eq("student_id", stu.id)
          .in("test_id", ts.map((t) => t.id));
        const map: Record<string, { score: number; total: number }> = {};
        for (const a of at || []) map[a.test_id] = { score: a.score, total: a.total };
        if (!cancelled) setAttemptsById(map);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session.login_number, session.student_class]);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="font-display text-lg font-semibold">My Tests</h2>
      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      ) : tests.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">No tests available for your class yet.</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {tests.map((t) => {
            const done = attemptsById[t.id];
            return (
              <li key={t.id} className="rounded-xl border border-border bg-background p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.subject}{t.chapter ? ` · ${t.chapter}` : ""} · {t.time_limit_min}m · {t.total_marks} marks
                  </div>
                  <div className="mt-1">
                    {t.is_free ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        FREE
                      </span>
                    ) : t.discount_price != null && Number(t.discount_price) < Number(t.price || 0) ? (
                      <span className="text-[11px]">
                        <span className="font-semibold text-primary">₹{t.discount_price}</span>{" "}
                        <span className="line-through text-muted-foreground">₹{t.price}</span>
                      </span>
                    ) : Number(t.price || 0) > 0 ? (
                      <span className="text-[11px] font-semibold text-primary">₹{t.price}</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">FREE</span>
                    )}
                  </div>
                </div>
                {done ? (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {done.score}/{done.total}
                    </div>
                    <Link to="/student/test/$id" params={{ id: t.id }} className="text-xs text-primary hover:underline">
                      View result
                    </Link>
                  </div>
                ) : (
                  <Link
                    to="/student/test/$id"
                    params={{ id: t.id }}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
                  >
                    Start
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Material = {
  id: string;
  subject: string;
  chapter: string;
  title: string;
  description: string | null;
  teacher_name: string | null;
  file_path: string | null;
  file_type: string;
  created_at: string;
};

function matIcon(t: string) {
  const x = t.toLowerCase();
  if (x.includes("pdf")) return <FileText className="size-4" />;
  if (x.includes("image") || ["png", "jpg", "jpeg", "webp", "gif"].includes(x))
    return <ImageIcon className="size-4" />;
  return <FileIcon className="size-4" />;
}

async function openMaterial(
  path: string,
  session: Session,
  download = false,
) {
  const lower = path.toLowerCase();
  const supportsWm = /\.(pdf|png|jpe?g)$/i.test(lower);
  if (!supportsWm) {
    const { data, error } = await supabase.storage
      .from("study-materials")
      .createSignedUrl(path, 60 * 60, download ? { download: true } : undefined);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank");
    return;
  }
  try {
    const resp = await fetch("/api/public/watermark-material", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        studentName: session.name,
        studentClass: session.student_class,
        rollNumber: (session as any).roll_number || "",
        download,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(t || `HTTP ${resp.status}`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      const base = (path.split("/").pop() || "file").replace(/\.[^.]+$/, "");
      a.download = `${base}-watermarked.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(url, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e: any) {
    toast.error(e?.message || "Could not open file");
  }
}

function MyMaterials({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [mats, setMats] = useState<Material[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const raw = String(session.student_class || "").trim();
      const num = raw.match(/\d+/)?.[0] ?? raw;
      const variants = Array.from(
        new Set([raw, num, `Class ${num}`, `class ${num}`, `CLASS ${num}`]),
      );
      const { data } = await supabase
        .from("study_materials")
        .select("id, subject, chapter, title, description, teacher_name, file_path, file_type, created_at")
        .in("student_class", variants)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setMats((data || []) as Material[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.student_class]);

  const grouped = mats.reduce<Record<string, Record<string, Material[]>>>((g, m) => {
    g[m.subject] ??= {};
    g[m.subject][m.chapter] ??= [];
    g[m.subject][m.chapter].push(m);
    return g;
  }, {});

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <BookOpen className="size-5" /> Study Materials
      </h2>
      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      ) : mats.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No materials uploaded for your class yet.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([sub, chapters]) => (
            <div key={sub}>
              <div className="text-sm font-semibold text-primary">{sub}</div>
              <div className="mt-2 space-y-3">
                {Object.entries(chapters).map(([chap, items]) => (
                  <div key={chap}>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {chap}
                    </div>
                    <ul className="mt-1.5 space-y-1.5">
                      {items.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-lg border border-border bg-background p-3 flex items-center gap-3"
                        >
                          <div className="size-9 rounded-md bg-secondary grid place-items-center text-secondary-foreground">
                            {matIcon(m.file_type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{m.title}</div>
                            {m.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {m.description}
                              </div>
                            )}
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {m.teacher_name ? `${m.teacher_name} · ` : ""}
                              {new Date(m.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              title="View"
                              onClick={() => m.file_path && openMaterial(m.file_path, session)}
                              className="p-1.5 rounded-md hover:bg-secondary"
                            >
                              <Eye className="size-4" />
                            </button>
                            <button
                              title="Download"
                              onClick={() => m.file_path && openMaterial(m.file_path, session, true)}
                              className="p-1.5 rounded-md hover:bg-secondary"
                            >
                              <Download className="size-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type LiveClassRow = {
  id: string;
  title: string;
  subject: string | null;
  room_code: string;
  teacher_name: string | null;
  status: string;
  scheduled_at: string | null;
};

function MyClasses({ session }: { session: Session }) {
  const [items, setItems] = useState<LiveClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("live_classes")
      .select("id,title,subject,room_code,teacher_name,status,scheduled_at")
      .eq("student_class", session.student_class)
      .in("status", ["scheduled", "live"])
      .order("created_at", { ascending: false });
    setItems((data as LiveClassRow[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [session.student_class]);

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        🎥 Live Classes
      </h2>
      <ul className="mt-4 space-y-2">
        {items.map((c) => (
          <li key={c.id} className="rounded-xl border border-border bg-background p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{c.title}</span>
                {c.status === "live" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-semibold animate-pulse">● LIVE</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {c.subject || "Class"}{c.teacher_name ? ` · ${c.teacher_name}` : ""}
                {c.scheduled_at ? ` · ${new Date(c.scheduled_at).toLocaleString()}` : ""}
              </div>
            </div>
            <Link
              to="/student/class/$code"
              params={{ code: c.room_code }}
              search={{ role: "student" as const, name: undefined }}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                c.status === "live"
                  ? "bg-emerald-600 text-white hover:opacity-90"
                  : "border border-border hover:bg-secondary"
              }`}
            >
              {c.status === "live" ? "Join now" : "Open"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const authCss = `
.vja-auth-page { background: linear-gradient(135deg, #eceef5 0%, #f8f9fc 100%); }
.vja-stage { position: relative; width: min(92vw, 480px); aspect-ratio: 1; display: grid; place-items: center; }

/* घूमते, आकार बदलते घेरे */
.vja-orbits { position: absolute; inset: 0; animation: vja-rot 12s linear infinite; pointer-events: none; }
.vja-orbits i { position: absolute; inset: 0; border-radius: 50%; border: 5px solid; opacity: .88; animation: vja-morphA 2.2s ease-in-out infinite alternate; }
.vja-orbits i:nth-child(1) { border-color: #4f46e5; }
.vja-orbits i:nth-child(2) { border-color: #f5b301; animation-name: vja-morphB; animation-delay: -.7s; }
.vja-orbits i:nth-child(3) { border-color: #06b6d4; animation-delay: -1.4s; }
.vja-orbits i:nth-child(4) { border-color: #84cc16; animation-name: vja-morphB; animation-delay: -2.1s; }
@keyframes vja-rot { to { transform: rotate(360deg); } }
@keyframes vja-morphA {
  0%   { transform: scale(.95) rotate(0);     border-radius: 45% 55% 48% 52% / 42% 48% 52% 58%; }
  50%  { transform: scale(1.04) rotate(8deg); border-radius: 58% 42% 55% 45% / 48% 62% 38% 52%; }
  100% { transform: scale(.97) rotate(-4deg); border-radius: 38% 62% 45% 55% / 58% 52% 48% 42%; }
}
@keyframes vja-morphB {
  0%   { transform: scale(1.05) rotate(10deg); border-radius: 55% 45% 58% 42% / 52% 48% 52% 48%; }
  50%  { transform: scale(.94) rotate(-8deg);  border-radius: 42% 58% 45% 55% / 48% 60% 40% 52%; }
  100% { transform: scale(1.02) rotate(5deg);  border-radius: 60% 40% 52% 48% / 42% 58% 42% 58%; }
}

.vja-box { position: relative; z-index: 2; width: min(320px, 68%); text-align: center; animation: vja-fade .35s ease both; }
@keyframes vja-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.vja-title { font-size: 26px; font-weight: 600; color: #25235a; margin-bottom: 6px; }
.vja-sub { font-size: 12.5px; color: #6c6f93; margin-bottom: 18px; }
.vja-g { margin-bottom: 12px; }
.vja-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.vja-input {
  width: 100%; padding: 12px 20px; border: 2px solid #4f46e5; border-radius: 25px; background: #fff; color: #25235a;
  font-size: 14px; outline: none; transition: box-shadow .25s;
}
.vja-input::placeholder { color: #9a9dc4; }
.vja-input:focus { box-shadow: 0 0 0 4px rgba(79,70,229,.15); }
.vja-num { text-align: center; font: 700 20px ui-monospace, Menlo, monospace; letter-spacing: .35em; padding-left: 26px; }
.vja-shake .vja-input { border-color: #e11d48; animation: vja-shake .4s; }
@keyframes vja-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } }

.vja-btn {
  width: 100%; padding: 12px; margin-top: 6px; border: 0; border-radius: 25px; color: #fff; cursor: pointer;
  font-size: 16px; font-weight: 600; background: linear-gradient(to right, #4f46e5, #06b6d4);
  display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform .2s, box-shadow .2s;
}
.vja-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(79,70,229,.3); }
.vja-btn:disabled { cursor: wait; opacity: .9; }
.vja-sp { width: 16px; height: 16px; border: 3px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: vja-spin .6s linear infinite; }
@keyframes vja-spin { to { transform: rotate(360deg); } }

.vja-links { margin-top: 16px; font-size: 13px; color: #6c6f93; }
.vja-link { background: none; border: 0; padding: 0; color: #4f46e5; font-weight: 600; cursor: pointer; font-size: inherit; }
.vja-link:hover { color: #06b6d4; text-decoration: underline; }

.vja-numshow { margin: 8px 0 14px; font: 700 30px ui-monospace, Menlo, monospace; letter-spacing: .28em; padding-left: .28em; color: #25235a; }
`;

function StudentPage() {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) setSession(JSON.parse(raw) as Session);
    setHydrated(true);
  }, []);

  // Any nested student route renders its own full-screen experience.
  if (location.pathname !== "/student" && location.pathname !== "/student/") {
    return <Outlet />;
  }


  function persist(s: Session | null) {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
    setSession(s);
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
                Vertex Junior Academy
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Student Portal
              </div>
            </div>
          </Link>
          {session && (
            <button
              onClick={() => persist(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 sm:text-sm"
            >
              <LogOut className="size-4" /> Logout
            </button>
          )}
        </div>
      </header>

      {!hydrated ? (
        <main className="grid min-h-[calc(100vh-65px)] place-items-center bg-slate-950 px-5 text-sm text-slate-400">
          Loading…
        </main>
      ) : session ? (
        <StudentReports session={session} />
      ) : (
        <main className="vja-auth-page relative flex min-h-[calc(100vh-65px)] items-center justify-center overflow-hidden px-4 py-10">
          <style>{authCss}</style>
          <div className="vja-stage">
            <div className="vja-orbits" aria-hidden="true">
              <i /><i /><i /><i />
            </div>
            <div className="vja-box" key={mode}>
              {mode === "login" ? (
                <LoginForm onSuccess={persist} onSwitch={() => setMode("register")} />
              ) : (
                <RegisterForm onLoginAfter={persist} onSwitch={() => setMode("login")} />
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

function LoginForm({ onSuccess, onSwitch }: { onSuccess: (s: Session) => void; onSwitch: () => void }) {
  const [loginNumber, setLoginNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  function fail(msg: string) {
    toast.error(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = loginNumber.trim();
    if (!/^\d{6}$/.test(code)) return fail("Enter your 6-digit login number");
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("name, student_class, roll_number, login_number")
      .eq("login_number", code)
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return fail("Invalid login number");
    onSuccess(data as Session);
  }

  return (
    <>
      <h1 className="vja-title">Student Login</h1>
      <p className="vja-sub">अपना 6-digit login number डालें</p>

      <form onSubmit={submit}>
        <div className={`vja-g ${shake ? "vja-shake" : ""}`}>
          <input
            className="vja-input vja-num"
            inputMode="numeric"
            maxLength={6}
            value={loginNumber}
            onChange={(e) => setLoginNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            autoComplete="off"
            aria-label="Login number"
          />
        </div>
        <button className="vja-btn" disabled={loading}>
          {loading && <span className="vja-sp" />}
          {loading ? "जाँच हो रही है" : "Login"}
        </button>
      </form>

      <div className="vja-links">
        नए छात्र?{" "}
        <button type="button" className="vja-link" onClick={onSwitch}>
          Register
        </button>
      </div>
    </>
  );
}

function RegisterForm({ onLoginAfter, onSwitch }: { onLoginAfter: (s: Session) => void; onSwitch: () => void }) {
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [issued, setIssued] = useState<Session | null>(null);
  const [shakeKey, setShakeKey] = useState<"" | "name" | "cls" | "roll">("");

  function fail(which: "name" | "cls" | "roll", msg: string) {
    toast.error(msg);
    setShakeKey(which);
    setTimeout(() => setShakeKey(""), 450);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const c = studentClass.trim();
    const r = rollNumber.trim();
    if (n.length < 2) return fail("name", "Enter your full name");
    if (!c) return fail("cls", "Enter your class");
    if (!r) return fail("roll", "Enter your roll number");

    setLoading(true);
    // Try a few times in case of unique collision
    for (let i = 0; i < 5; i++) {
      const login_number = generateLoginNumber();
      const { data, error } = await supabase
        .from("students")
        .insert({ name: n, student_class: c, roll_number: r, login_number })
        .select("name, student_class, roll_number, login_number")
        .single();
      if (!error && data) {
        setIssued(data as Session);
        setLoading(false);
        return;
      }
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        setLoading(false);
        return toast.error(error.message);
      }
    }
    setLoading(false);
    toast.error("Could not generate a unique login number. Please try again.");
  }

  if (issued) {
    return (
      <>
        <h1 className="vja-title">Registered</h1>
        <p className="vja-sub">यह नंबर सुरक्षित रखें, हर बार login में चाहिए</p>
        <div className="vja-numshow">{issued.login_number}</div>
        <button className="vja-btn" onClick={() => onLoginAfter(issued)}>
          Continue to my reports
        </button>
        <div className="vja-links">
          <button
            type="button"
            className="vja-link"
            onClick={() => {
              navigator.clipboard.writeText(issued.login_number);
              toast.success("Copied");
            }}
          >
            <Copy className="mr-1 inline size-3.5" /> Copy number
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="vja-title">Register</h1>
      <p className="vja-sub">अपना login number पाएँ</p>

      <form onSubmit={submit}>
        <div className={`vja-g ${shakeKey === "name" ? "vja-shake" : ""}`}>
          <input
            className="vja-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="पूरा नाम"
            maxLength={100}
            autoComplete="off"
            aria-label="Full name"
          />
        </div>
        <div className="vja-two">
          <div className={`vja-g ${shakeKey === "cls" ? "vja-shake" : ""}`}>
            <input
              className="vja-input"
              value={studentClass}
              onChange={(e) => setStudentClass(e.target.value)}
              placeholder="Class"
              maxLength={20}
              autoComplete="off"
              aria-label="Class"
            />
          </div>
          <div className={`vja-g ${shakeKey === "roll" ? "vja-shake" : ""}`}>
            <input
              className="vja-input"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="Roll no."
              maxLength={20}
              autoComplete="off"
              aria-label="Roll number"
            />
          </div>
        </div>
        <button className="vja-btn" disabled={loading}>
          {loading && <span className="vja-sp" />}
          {loading ? "बन रहा है" : "Register"}
        </button>
      </form>

      <div className="vja-links">
        पहले से account है?{" "}
        <button type="button" className="vja-link" onClick={onSwitch}>
          Login
        </button>
      </div>
    </>
  );
}

function StudentReports({ session }: { session: Session }) {
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: stu } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      if (stu) {
        setStudentId(stu.id);
        // Auto-check rewards on dashboard load
        checkAndAwardRewards(stu.id).then((res) => {
          if (res.awarded.length > 0) {
            toast.success(
              `🎁 Congratulations! You unlocked: ${res.awarded.map((r) => r.title).join(", ")}`,
            );
          }
        });
      }
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .ilike("student_name", session.name)
        .order("week_start", { ascending: false });
      if (cancelled) return;
      if (error) toast.error(error.message);
      setReports((data as unknown as ReportRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.name, session.login_number]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl font-semibold">Hi, {session.name}</h1>
      <p className="text-muted-foreground mt-1">
        Class {session.student_class} · Roll {session.roll_number} · Login{" "}
        <span className="font-mono">{session.login_number}</span>
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/student/ai"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-md hover:opacity-90"
        >
          ✨ AI Study Helper
        </Link>
        <Link
          to="/student/reading"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2.5 text-sm font-semibold shadow-md hover:opacity-90"
        >
          🎤 Reading Practice
        </Link>
        <Link
          to="/student/imagine"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-500 text-white px-4 py-2.5 text-sm font-semibold shadow-md hover:opacity-90"
        >
          🎨 Imagine (AI Art)
        </Link>
      </div>

      <FeeSummary session={session} />

      <LeaderboardWidget studentId={studentId} />

      <RewardProgressCard studentId={studentId} onOpenTerms={() => setShowTerms(true)} />

      <MyClasses session={session} />

      <MyVisualWorksheets session={session} />

      <MyTests session={session} />

      <MyMaterials session={session} />

      <SyllabusCoordinatorCard loginNumber={session.login_number} defaultClass={session.student_class} />

      <PaymentHistory session={session} />

      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />







      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !reports || reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-display text-xl">No reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later — your teacher hasn't published one with this name.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const url = `/report/${r.code}`;
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold truncate">
                      {r.coaching_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(r.week_start).toLocaleDateString()} –{" "}
                      {new Date(r.week_end).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.subjects.length} subject{r.subjects.length === 1 ? "" : "s"} · Class{" "}
                      {r.student_class}
                    </div>
                  </div>
                  <a
                    href={url}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
                  >
                    Open <ExternalLink className="size-3.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function FeeSummary({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<{ total: number; paid: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      if (!student) {
        setTotals({ total: 0, paid: 0 });
        setLoading(false);
        return;
      }
      const { data: fees } = await supabase
        .from("fees")
        .select("total_fee, paid_amount")
        .eq("student_id", student.id);
      if (cancelled) return;
      const total = (fees ?? []).reduce((s, f) => s + Number(f.total_fee ?? 0), 0);
      const paid = (fees ?? []).reduce((s, f) => s + Number(f.paid_amount ?? 0), 0);
      setTotals({ total, paid });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.login_number]);

  const due = totals ? Math.max(totals.total - totals.paid, 0) : 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Fee Summary</h2>
        <span className="text-xs text-muted-foreground truncate">{session.name}</span>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      ) : !totals || totals.total === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No fee records yet. Your teacher hasn't set up your fees.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Fee</div>
            <div className="mt-1 text-2xl font-semibold font-display">{fmt(totals.total)}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Paid
            </div>
            <div className="mt-1 text-2xl font-semibold font-display text-emerald-700 dark:text-emerald-400">
              {fmt(totals.paid)}
            </div>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-400">Due</div>
            <div className="mt-1 text-2xl font-semibold font-display text-red-700 dark:text-red-400">
              {fmt(due)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type PaymentRow = {
  id: string;
  receipt_no: string;
  payment_date: string;
  paid_month: string;
  amount: number;
  payment_method: string;
  status: string;
};

function PaymentHistory({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [dueAmount, setDueAmount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("login_number", session.login_number)
        .maybeSingle();
      if (cancelled) return;
      if (!student) {
        setPayments([]);
        setLoading(false);
        return;
      }
      setStudentId(student.id);

      const [{ data: pays }, { data: fees }] = await Promise.all([
        supabase
          .from("payments")
          .select("id, receipt_no, payment_date, paid_month, amount, payment_method, status")
          .eq("student_id", student.id)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("fees").select("total_fee, paid_amount").eq("student_id", student.id),
      ]);
      if (cancelled) return;
      const total = (fees ?? []).reduce((s, f) => s + Number(f.total_fee ?? 0), 0);
      const paid = (fees ?? []).reduce((s, f) => s + Number(f.paid_amount ?? 0), 0);
      setDueAmount(Math.max(total - paid, 0));
      setPayments((pays ?? []) as PaymentRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.login_number]);

  function download(p: PaymentRow) {
    generateReceiptPdf({
      receipt_no: p.receipt_no,
      payment_date: p.payment_date,
      paid_month: p.paid_month,
      amount: Number(p.amount),
      due_amount: dueAmount,
      payment_method: p.payment_method,
      status: p.status,
      student_name: session.name,
      student_class: session.student_class,
    });
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Receipt className="size-5" /> Payment History
        </h2>
        <span className="text-xs text-muted-foreground">{payments.length} payments</span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="text-sm text-muted-foreground">No payments recorded yet.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {payments.map((p) => {
              const paid = p.status === "paid";
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 ${
                    paid ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-semibold">{p.receipt_no}</div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        paid
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/15 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">{p.paid_month}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.payment_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {p.payment_method}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div
                      className={`text-lg font-semibold ${
                        paid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {fmt(Number(p.amount))}
                    </div>
                    <button
                      onClick={() => download(p)}
                      className="inline-flex items-center gap-1.5 text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90"
                    >
                      <Download className="size-3.5" /> PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-2.5">Receipt No</th>
                  <th className="text-left p-2.5">Payment Date</th>
                  <th className="text-left p-2.5">Paid Month</th>
                  <th className="text-right p-2.5">Amount</th>
                  <th className="text-left p-2.5">Method</th>
                  <th className="text-left p-2.5">Status</th>
                  <th className="text-right p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => {
                  const paid = p.status === "paid";
                  return (
                    <tr key={p.id} className="hover:bg-secondary/30">
                      <td className="p-2.5 font-mono text-xs font-semibold">{p.receipt_no}</td>
                      <td className="p-2.5">
                        {new Date(p.payment_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2.5">{p.paid_month}</td>
                      <td
                        className={`p-2.5 text-right font-semibold ${
                          paid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {fmt(Number(p.amount))}
                      </td>
                      <td className="p-2.5 capitalize text-muted-foreground">{p.payment_method}</td>
                      <td className="p-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            paid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-red-500/15 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => download(p)}
                          className="inline-flex items-center gap-1.5 text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90"
                        >
                          <Download className="size-3.5" /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
