import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Wallet,
  FileText,
  Plus,
  LogOut,
  Menu,
  Moon,
  Sun,
  Bell,
  ClipboardList,
  Activity,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ADMIN_SESSION_KEY = "admin_ok_v1";

const NAV = [
  { to: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/teacher/students", label: "Students", icon: Users },
  { to: "/teacher/fees", label: "Fees", icon: Wallet },
  { to: "/teacher/tests", label: "Exams", icon: ClipboardList },
  { to: "/teacher/materials", label: "Materials", icon: BookOpen },
  { to: "/teacher/live", label: "Live Now", icon: Activity },
  { to: "/teacher/reports", label: "Reports", icon: FileText },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ShellInner>{children}</ShellInner>
    </ThemeProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    navigate({ to: "/teacher" });
    location.reload();
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col">
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-4 gap-3">
          <button
            className="md:hidden p-2 rounded-md hover:bg-secondary"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="font-display text-sm md:text-base font-semibold truncate">
            <span className="hidden sm:inline">Vertex Junior Academy · </span>Admin
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <Link
              to="/teacher/new"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90"
            >
              <Plus className="size-3.5" /> New report
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-md hover:bg-secondary"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );

  function SidebarContent({ onNav }: { onNav?: () => void } = {}) {
    return (
      <>
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <GraduationCap className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold truncate">Vertex Junior</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Academy</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => {
            const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
            const isLive = item.to === "/teacher/live";
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNav}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {isLive && <LiveBadge />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link
            to="/teacher/new"
            onClick={onNav}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:opacity-90"
          >
            <Plus className="size-3.5" /> New report
          </Link>
        </div>
      </>
    );
  }
}

function LiveBadge() {
  const { data: count = 0 } = useQuery({
    queryKey: ["live-count"],
    queryFn: async () => {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("test_attempts")
        .select("*", { count: "exact", head: true })
        .is("submitted_at", null)
        .gte("started_at", fifteenMinAgo);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 10000,
  });

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className="p-2 rounded-md hover:bg-secondary" aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [{ data: dues }, { data: newStudents }] = await Promise.all([
        supabase.from("fees").select("id, student_id, due_amount, students(name)").gt("due_amount", 0),
        supabase
          .from("students")
          .select("id, name, created_at")
          .gte("created_at", today.toISOString())
          .order("created_at", { ascending: false }),
      ]);
      return { dues: dues || [], newStudents: newStudents || [] };
    },
    refetchInterval: 60000,
  });

  const count = (data?.dues.length || 0) + (data?.newStudents.length || 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-secondary" aria-label="Notifications">
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute top-1 right-1 size-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <div className="font-display font-semibold">Notifications</div>
        </div>
        <div className="max-h-96 overflow-auto divide-y divide-border">
          {data?.newStudents.length ? (
            <div className="p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">New today</div>
              {data.newStudents.map((s: any) => (
                <div key={s.id} className="text-sm py-1">
                  {s.name}
                </div>
              ))}
            </div>
          ) : null}
          {data?.dues.length ? (
            <div className="p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pending fees</div>
              {data.dues.slice(0, 10).map((d: any) => (
                <div key={d.id} className="text-sm py-1 flex justify-between gap-2">
                  <span className="truncate">{d.students?.name || "Student"}</span>
                  <span className="font-medium text-destructive">₹{Number(d.due_amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : null}
          {!data?.newStudents.length && !data?.dues.length && (
            <div className="p-6 text-center text-sm text-muted-foreground">All caught up</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


