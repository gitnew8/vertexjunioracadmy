import { SyllabusCoordinatorCard } from "@/components/syllabus-coordinator-card";
import { LeaderboardWidget } from "@/components/leaderboard";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ReportRow } from "@/lib/types";
import {
  GraduationCap,
  LogOut,
  Calendar,
  ExternalLink,
  Lock,
  UserPlus,
  Copy,
  CheckCircle2,
  Download,
  Receipt,
  BookOpen,
  Eye,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
} from "lucide-react";
import { generateReceiptPdf } from "@/lib/receipt";
import { toast, Toaster } from "sonner";
import { RewardProgressCard } from "@/components/reward-progress-card";
import { TermsModal } from "@/components/terms-modal";
import { checkAndAwardRewards } from "@/lib/rewards";

export const Route = createFileRoute("/student")({
  component: StudentPage,
  head: () => ({ meta: [{ title: "Student login — WeeklyReport" }] }),
});

const SESSION_KEY = "student_session_v2";

type Session = {
  name: string;
  student_class: string;
  roll_number: string;
  login_number: string;
};

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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function generateLoginNumber() {
  // 6-digit number, leading zeros allowed
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

/**
 * Canonical class normalizer.
 * "Class VIII-B" | "VIII-B" | "8" | "class 8"  → all collapse predictably.
 * Roman numerals I–XII are mapped to Arabic numerals so a student who
 * registers as "VIII-B" still matches tests/materials stored as "8".
 */
const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6",
  vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12",
  ukg: "ukg", lkg: "lkg", nursery: "nursery", kg: "kg",
};

export function normalizeClass(input: string): string {
  const raw = (input || "").toLowerCase().trim();
  if (!raw) return "";
  // strip leading "class"
  const noPrefix = raw.replace(/^class\s*/, "").trim();
  // split into alpha + numeric parts, e.g. "viii-b" → ["viii","b"]
  const token = noPrefix.split(/[\s\-_]+/)[0] || "";
  const mapped = ROMAN[token] ?? token.replace(/[^a-z0-9]/g, "");
  return mapped;
}

/** All class strings a given student class should be considered equal to. */
export function classVariants(input: string): string[] {
  const raw = (input || "").trim();
  const norm = normalizeClass(raw);
  const digits = raw.match(/\d+/)?.[0] ?? "";
  const variants = new Set<string>([
    raw,
    raw.toLowerCase(),
    norm,
    digits,
    `class ${norm}`,
    `class ${digits}`,
    `Class ${norm}`,
    `Class ${digits}`,
  ]);
  return Array.from(variants).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* MyVisualWorksheets                                                  */
/* ------------------------------------------------------------------ */

function MyVisualWorksheets({ session }: { session: Session }) {
  const [rows, setRows] = useState<
    { id: string; title: string; subject: string; student_class: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("visual_papers")
        .select("id,title,subject,student_class")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      const want = normalizeClass(session.student_class);
      const wantBase = want.replace(/\s*\d+$/, "").trim();

      setRows(
        (data || []).filter((r) => {
          const c = normalizeClass(r.student_class);
          return (
            c === want ||
            (!!wantBase && wantBase !== want && c === wantBase)
          );
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

/* ------------------------------------------------------------------ */
/* MyTests                                                             */
/* ------------------------------------------------------------------ */

function MyTests({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [attemptsById, setAttemptsById] = useState<
    Record<string, { score: number; total: number }>
  >({});

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

      const variants = classVariants(session.student_class);
      const { data: ts } = await supabase
        .from("tests")
        .select(
          "id, title, subject, chapter, time_limit_min, total_marks, is_free, price, discount_price",
        )
        .in("student_class", variants)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setTests((ts || []) as StudentTest[]);

      if (stu && ts?.length) {
        const { data: at } = await supabase
          .from("test_attempts")
          .select("test_id, score, total")
          .eq("student_id", stu.id)
          .in(
            "test_id",
            ts.map((t) => t.id),
          );
        if (cancelled) return;
        const map: Record<string, { score: number; total: number }> = {};
        for (const a of at || []) map[a.test_id] = { score: a.score, total: a.total };
        setAttemptsById(map);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.login_number, session.student_class]);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="font-display text-lg font-semibold">My Tests</h2>
      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      ) : tests.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No tests available for your class yet.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {tests.map((t) => {
            const done = attemptsById[t.id];
            return (
              <li
                key={t.id}
                className="rounded-xl border border-border bg-background p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.subject}
                    {t.chapter ? ` · ${t.chapter}` : ""} · {t.time_limit_min}m ·{" "}
                    {t.total_marks} marks
                  </div>
                  <div className="mt-1">
                    {t.is_free ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        FREE
                      </span>
                    ) : t.discount_price != null &&
                      Number(t.discount_price) < Number(t.price || 0) ? (
                      <span className="text-[11px]">
                        <span className="font-semibold text-primary">
                          ₹{t.discount_price}
                        </span>{" "}
                        <span className="line-through text-muted-foreground">
                          ₹{t.price}
                        </span>
                      </span>
                    ) : Number(t.price || 0) > 0 ? (
                      <span className="text-[11px] font-semibold text-primary">
                        ₹{t.price}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        FREE
                      </span>
                    )}
                  </div>
                </div>
                {done ? (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {done.score}/{done.total}
                    </div>
                    <Link
                      to="/student/test/$id"
                      params={{ id: t.id }}
                      className="text-xs text-primary hover:underline"
                    >
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

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

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
  const x = (t || "").toLowerCase();
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
  // Watermarking supports PDF + raster images only. Everything else uses
  // a short-lived signed URL (no watermark) — uploads should be restricted
  // to these formats at the source to prevent unwatermarked leakage.
  const supportsWm = /\.(pdf|png|jpe?g)$/i.test(lower);

  if (!supportsWm) {
    const { data, error } = await supabase.storage
      .from("study-materials")
      .createSignedUrl(path, 60 * 60, download ? { download: true } : undefined);
    if (error || !data?.signedUrl) {
      toast.error("Could not open file");
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
        rollNumber: session.roll_number || "",
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
      const variants = classVariants(session.student_class);
      const { data } = await supabase
        .from("study_materials")
        .select(
          "id, subject, chapter, title, description, teacher_name, file_path, file_type, created_at",
        )
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

  const grouped = mats.reduce<Record<string, Record<string, Material[]>>>(
    (g, m) => {
      g[m.subject] ??= {};
      g[m.subject][m.chapter] ??= [];
      g[m.subject][m.chapter].push(m);
      return g;
    },
    {},
  );

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
                              type="button"
                              aria-label="View material"
                              title="View"
                              onClick={() =>
                                m.file_path && openMaterial(m.file_path, session)
                              }
                              className="p-1.5 rounded-md hover:bg-secondary"
                            >
                              <Eye className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Download material"
                              title="Download"
                              onClick={() =>
                                m.file_path &&
                                openMaterial(m.file_path, session, true)
                              }
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

/* ------------------------------------------------------------------ */
/* MyClasses                                                           */
/* ------------------------------------------------------------------ */

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("live_classes")
        .select(
          "id,title,subject,room_code,teacher_name,status,scheduled_at",
        )
        .in("student_class", classVariants(session.student_class))
        .in("status", ["scheduled", "live"])
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setItems((data as LiveClassRow[]) || []);
        setLoading(false);
      }
    }

    load();
    const t = setInterval(() => {
      // Pause polling when tab is hidden to reduce load
      if (document.visibilityState === "visible") load();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
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
          <li
            key={c.id}
            className="rounded-xl border border-border bg-background p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{c.title}</span>
                {c.status === "live" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-semibold animate-pulse">
                    ● LIVE
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {c.subject || "Class"}
                {c.teacher_name ? ` · ${c.teacher_name}` : ""}
                {c.scheduled_at
                  ? ` · ${new Date(c.scheduled_at).toLocaleString()}`
                  : ""}
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

/* ------------------------------------------------------------------ */
/* StudentPage                                                         */
/* ------------------------------------------------------------------ */

function StudentPage() {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as Session);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
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
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-none">
                Vertex Junior Academy
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Student Portal
              </div>
            </div>
          </Link>

          {session && (
            <button
              type="button"
              onClick={() => persist(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-4 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              <LogOut className="size-4" />
              Logout
            </button>
          )}
        </div>
      </header>

      {!hydrated ? (
        <main className="grid flex-1 place-items-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading...
          </div>
        </main>
      ) : session ? (
        <StudentReports session={session} />
      ) : (
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-10">
          <div className="grid w-full overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl lg:grid-cols-2">
            {/* Left visual panel */}
            <div className="relative hidden min-h-[650px] overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/60 p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
              <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-white/10 blur-3xl" />

              <div className="relative z-10">
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur">
                  🎓 Smart Student Portal
                </div>
                <h2 className="mt-8 max-w-md text-4xl font-bold leading-tight">
                  Learn. Practice.
                  <br />
                  Grow. Succeed.
                </h2>
                <p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/80">
                  Access your reports, tests, study materials, fees and
                  academic progress from one simple dashboard.
                </p>
              </div>

              <div className="relative z-10 flex justify-center">
                <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
                  <img
                    src="/images/student-login.png"
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0";
                    }}
                    className="mx-auto max-h-[320px] w-full object-contain drop-shadow-2xl"
                  />
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="font-bold">Tests</div>
                      <div className="mt-1 text-white/70">Practice</div>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="font-bold">Reports</div>
                      <div className="mt-1 text-white/70">Progress</div>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="font-bold">Materials</div>
                      <div className="mt-1 text-white/70">Study</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 text-xs text-primary-foreground/70">
                Powered by Vertex Junior Academy
              </div>
            </div>

            {/* Right form panel */}
            <div className="flex min-h-[650px] items-center justify-center p-6 sm:p-10">
              <div className="w-full max-w-md">
                {/* Mobile logo (hidden on desktop) */}
                <div className="mb-8 flex items-center gap-3 lg:hidden">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                    <GraduationCap className="size-5" />
                  </div>
                  <div>
                    <div className="font-display font-bold">
                      Vertex Junior Academy
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Student Portal
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="relative mb-8 grid grid-cols-2 rounded-2xl bg-secondary/70 p-1.5">
                  {/* Sliding indicator — width is half minus the 6px (p-1.5)
                      padding on each side; translate is 100% + 6px to hop. */}
                  <div
                    className={`absolute bottom-1.5 top-1.5 w-[calc(50%-6px)] rounded-xl bg-background shadow-sm transition-transform duration-300 ${
                      mode === "register"
                        ? "translate-x-[calc(100%+6px)]"
                        : "translate-x-0"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`relative z-10 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      mode === "login"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`relative z-10 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      mode === "register"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Register
                  </button>
                </div>

                <div
                  key={mode}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {mode === "login" ? (
                    <LoginForm onSuccess={persist} />
                  ) : (
                    <RegisterForm onLoginAfter={persist} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LoginForm                                                           */
/* ------------------------------------------------------------------ */

function LoginForm({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [loginNumber, setLoginNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const code = loginNumber.trim();
    if (!/^\d{6}$/.test(code)) {
      return toast.error("Enter your 6-digit login number");
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("name, student_class, roll_number, login_number")
      .eq("login_number", code)
      .maybeSingle();
    setLoading(false);

    if (error) {
      console.error("Login error:", error);
      return toast.error("Could not sign in. Please try again.");
    }
    if (!data) return toast.error("Invalid login number");

    onSuccess(data as Session);
  }

  return (
    <div>
      <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Lock className="size-6" />
      </div>

      <h1 className="font-display text-3xl font-bold tracking-tight">
        Welcome back 👋
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Login using the 6-digit login number provided during registration.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Login Number
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={loginNumber}
              onChange={(e) =>
                setLoginNumber(e.target.value.replace(/\D/g, ""))
              }
              placeholder="Enter 6-digit number"
              className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-4 text-center font-mono text-xl tracking-[0.35em] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Example: 123456</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:opacity-95 disabled:pointer-events-none disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="size-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Checking...
            </>
          ) : (
            <>
              Login to Student Portal
              <span className="text-lg">→</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Don't have a login number?
        </p>
        <p className="mt-1 text-sm font-semibold">
          Use the <span className="text-primary">Register</span> tab above.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RegisterForm                                                        */
/* ------------------------------------------------------------------ */

function RegisterForm({
  onLoginAfter,
}: {
  onLoginAfter: (s: Session) => void;
}) {
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [issued, setIssued] = useState<Session | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const n = name.trim();
    const c = studentClass.trim();
    const r = rollNumber.trim();

    if (n.length < 2) return toast.error("Enter your full name");
    if (!c) return toast.error("Enter your class");
    if (!r) return toast.error("Enter your roll number");

    setLoading(true);

    for (let i = 0; i < 5; i++) {
      const login_number = generateLoginNumber();
      const { data, error } = await supabase
        .from("students")
        .insert({
          name: n,
          student_class: c,
          roll_number: r,
          login_number,
        })
        .select("name, student_class, roll_number, login_number")
        .single();

      if (!error && data) {
        setIssued(data as Session);
        setLoading(false);
        return;
      }

      // Non-duplicate error → stop
      if (error && !/duplicate/i.test(error.message ?? "")) {
        console.error("Register error:", error);
        setLoading(false);
        return toast.error("Registration failed. Please try again.");
      }
      // else: duplicate login_number, loop and retry
    }

    setLoading(false);
    toast.error("Could not generate a unique login number. Please try again.");
  }

  /* Success screen */
  if (issued) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-display text-3xl font-bold">
            Registration Complete 🎉
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your student account has been created successfully.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Login Number
          </div>
          <div className="mt-3 font-mono text-4xl font-bold tracking-[0.25em] text-primary">
            {issued.login_number}
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(issued.login_number);
                toast.success("Login number copied");
              } catch {
                toast.error("Copy failed — please note it down manually");
              }
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
          >
            <Copy className="size-4" />
            Copy Login Number
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-secondary/50 p-4 text-center">
          <p className="text-xs leading-5 text-muted-foreground">
            ⚠️ Save this number carefully. You will need it whenever you
            login to your student portal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onLoginAfter(issued)}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:opacity-95"
        >
          Continue to Student Portal
          <span className="text-lg">→</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <UserPlus className="size-6" />
      </div>

      <h1 className="font-display text-3xl font-bold tracking-tight">
        Create Account
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Register as a student and get your unique login number.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        {/* Name */}
        <div>
          <label className="mb-2 block text-sm font-semibold">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aarav Sharma"
            maxLength={100}
            className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>

        {/* Class + Roll */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">Class</label>
            <input
              value={studentClass}
              onChange={(e) => setStudentClass(e.target.value)}
              placeholder="e.g. VIII-B or 8"
              maxLength={20}
              className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Roll Number
            </label>
            <input
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. 14"
              maxLength={20}
              className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:opacity-95 disabled:pointer-events-none disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="size-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Creating Account...
            </>
          ) : (
            <>
              Create Student Account
              <UserPlus className="size-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Your login number will be generated automatically after successful
          registration.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StudentReports (dashboard)                                          */
/* ------------------------------------------------------------------ */

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
        // Auto-check rewards on dashboard load (idempotent server-side)
        checkAndAwardRewards(stu.id).then((res) => {
          if (res.awarded.length > 0) {
            toast.success(
              `🎁 Congratulations! You unlocked: ${res.awarded
                .map((r) => r.title)
                .join(", ")}`,
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

      if (error) {
        console.error("Reports fetch error:", error);
        toast.error("Could not load your reports.");
      }
      setReports((data as unknown as ReportRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.name, session.login_number]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl font-semibold">
        Hi, {session.name}
      </h1>
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
      <RewardProgressCard
        studentId={studentId}
        onOpenTerms={() => setShowTerms(true)}
      />
      <MyClasses session={session} />
      <MyVisualWorksheets session={session} />
      <MyTests session={session} />
      <MyMaterials session={session} />
      <SyllabusCoordinatorCard
        loginNumber={session.login_number}
        defaultClass={session.student_class}
      />
      <PaymentHistory session={session} />
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />

      <div className="mt-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !reports || reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-display text-xl">No reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later — your teacher hasn't published one with this
              name.
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
                      {r.subjects.length} subject
                      {r.subjects.length === 1 ? "" : "s"} · Class{" "}
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

/* ------------------------------------------------------------------ */
/* FeeSummary                                                          */
/* ------------------------------------------------------------------ */

function FeeSummary({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<{ total: number; paid: number } | null>(
    null,
  );

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

      const total = (fees ?? []).reduce(
        (s, f) => s + Number(f.total_fee ?? 0),
        0,
      );
      const paid = (fees ?? []).reduce(
        (s, f) => s + Number(f.paid_amount ?? 0),
        0,
      );
      setTotals({ total, paid });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.login_number]);

  const due = totals ? Math.max(totals.total - totals.paid, 0) : 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Fee Summary</h2>
        <span className="text-xs text-muted-foreground truncate">
          {session.name}
        </span>
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Fee
            </div>
            <div className="mt-1 text-2xl font-semibold font-display">
              {fmt(totals.total)}
            </div>
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
            <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-400">
              Due
            </div>
            <div className="mt-1 text-2xl font-semibold font-display text-red-700 dark:text-red-400">
              {fmt(due)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* PaymentHistory                                                      */
/* ------------------------------------------------------------------ */

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

      const [{ data: pays }, { data: fees }] = await Promise.all([
        supabase
          .from("payments")
          .select(
            "id, receipt_no, payment_date, paid_month, amount, payment_method, status",
          )
          .eq("student_id", student.id)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("fees")
          .select("total_fee, paid_amount")
          .eq("student_id", student.id),
      ]);
      if (cancelled) return;

      const total = (fees ?? []).reduce(
        (s, f) => s + Number(f.total_fee ?? 0),
        0,
      );
      const paid = (fees ?? []).reduce(
        (s, f) => s + Number(f.paid_amount ?? 0),
        0,
      );
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
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Receipt className="size-5" /> Payment History
        </h2>
        <span className="text-xs text-muted-foreground">
          {payments.length} payments
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No payments recorded yet.
        </div>
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
                    paid
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-semibold">
                      {p.receipt_no}
                    </div>
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
                        paid
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {fmt(Number(p.amount))}
                    </div>
                    <button
                      type="button"
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
                      <td className="p-2.5 font-mono text-xs font-semibold">
                        {p.receipt_no}
                      </td>
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
                          paid
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {fmt(Number(p.amount))}
                      </td>
                      <td className="p-2.5 capitalize text-muted-foreground">
                        {p.payment_method}
                      </td>
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
                          type="button"
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
