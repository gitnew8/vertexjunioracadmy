export type SiteTheme = {
  id: string;
  name: string;
  /** legacy field: full uploaded .html document (styles extracted from it) */
  html: string;
  css: string;
  js: string;
  target: string;
  start_date: string | null;
  end_date: string | null;
  repeat_yearly: boolean;
  priority: number;
  active: boolean;
  is_default: boolean;
  force_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const THEME_TARGETS: Array<{ value: string; label: string }> = [
  { value: "global", label: "Entire Website (all pages)" },
  { value: "student-login", label: "Student Login" },
  { value: "student-dashboard", label: "Student Dashboard" },
  { value: "student-profile", label: "Student Profile" },
  { value: "test", label: "Test / Worksheet" },
  { value: "result", label: "Result / Report" },
  { value: "teacher-dashboard", label: "Teacher Dashboard" },
  { value: "admin", label: "Admin Panel" },
];

/** Body classes exposed to theme code for the current page + login state. */
export function pageClasses(path: string): string[] {
  const p = path.toLowerCase();
  const out = ["theme-active"];
  if (p === "/" || p.startsWith("/login") || p.startsWith("/student/login")) out.push("student-login");
  if (p === "/student" || p.startsWith("/student/")) out.push("student-dashboard", "login-success");
  if (p.startsWith("/student/profile")) out.push("student-profile");
  if (p.includes("/test") || p.includes("/visual")) out.push("page-test");
  if (p.startsWith("/report") || p.includes("/result") || p.startsWith("/leaderboard")) out.push("page-result");
  if (p.startsWith("/teacher")) out.push("teacher-dashboard", "admin-panel", "login-success");
  return out;
}

/** Does a theme's target apply to this path? */
export function targetMatches(target: string, path: string): boolean {
  const p = path.toLowerCase();
  switch (target) {
    case "global":
    case "":
    case null as unknown as string:
      return true;
    case "student-login":
      return p === "/" || p.startsWith("/login") || p.startsWith("/student/login");
    case "student-dashboard":
      return p === "/student" || p.startsWith("/student");
    case "student-profile":
      return p.startsWith("/student/profile");
    case "test":
      return p.includes("/test") || p.includes("/visual");
    case "result":
      return p.startsWith("/report") || p.includes("/result") || p.startsWith("/leaderboard");
    case "teacher-dashboard":
    case "admin":
      return p.startsWith("/teacher");
    default:
      return true;
  }
}

/** Current date in India/IST as {y,m,d} */
export function istToday(now: Date = new Date()): { y: number; m: number; d: number } {
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return { y: ist.getFullYear(), m: ist.getMonth() + 1, d: ist.getDate() };
}

function toNum({ y, m, d }: { y: number; m: number; d: number }) {
  return y * 10000 + m * 100 + d;
}

function parse(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

/** Does a theme's date window include today (IST)? */
export function isInWindow(t: SiteTheme, today = istToday()): boolean {
  if (!t.start_date && !t.end_date) return false;
  const start = t.start_date ? parse(t.start_date) : null;
  const end = t.end_date ? parse(t.end_date) : start;
  if (!start || !end) return false;

  if (t.repeat_yearly) {
    const cur = today.m * 100 + today.d;
    const s = start.m * 100 + start.d;
    const e = end.m * 100 + end.d;
    return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e;
  }
  const cur = toNum(today);
  return cur >= toNum(start) && cur <= toNum(end);
}

function tier(t: SiteTheme, path: string, today: { y: number; m: number; d: number }): number {
  const pageSpecific = (t.target || "global") !== "global";
  const dated = Boolean(t.start_date || t.end_date);
  if (t.force_active) return pageSpecific ? 6 : 5;
  if (dated && !isInWindow(t, today)) return -1; // scheduled but out of window
  if (pageSpecific) return 3; // page-specific theme beats scheduled global
  if (dated) return 2; // scheduled global theme
  if (t.is_default) return 1; // default theme
  return 2; // always-on global theme
}

const byRank = (path: string, today: { y: number; m: number; d: number }) => (a: SiteTheme, b: SiteTheme) =>
  tier(b, path, today) - tier(a, path, today) ||
  b.priority - a.priority ||
  (b.updated_at || "").localeCompare(a.updated_at || "");

/**
 * Highest ranked theme for a page.
 * Page-specific > scheduled > global > default.
 */
export function pickThemeForPath(
  themes: SiteTheme[],
  path = "/",
  today = istToday(),
): SiteTheme | null {
  const live = themes.filter((t) => t.active && targetMatches(t.target || "global", path));
  const ranked = live.filter((t) => tier(t, path, today) >= 0).sort(byRank(path, today));
  return ranked[0] || null;
}

/** Back-compat helper (global page). */
export function pickActiveTheme(themes: SiteTheme[], today = istToday()): SiteTheme | null {
  return pickThemeForPath(themes, "/", today);
}
