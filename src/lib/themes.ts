export type SiteTheme = {
  id: string;
  name: string;
  html: string;
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

/** Highest-priority theme that should be shown right now, or null. */
export function pickActiveTheme(themes: SiteTheme[], today = istToday()): SiteTheme | null {
  const live = themes.filter((t) => t.active);
  const byPriority = (a: SiteTheme, b: SiteTheme) =>
    b.priority - a.priority || (b.updated_at || "").localeCompare(a.updated_at || "");

  const forced = live.filter((t) => t.force_active).sort(byPriority);
  if (forced.length) return forced[0];

  const scheduled = live.filter((t) => !t.is_default && isInWindow(t, today)).sort(byPriority);
  if (scheduled.length) return scheduled[0];

  const def = live.filter((t) => t.is_default).sort(byPriority);
  return def[0] || null;
}
