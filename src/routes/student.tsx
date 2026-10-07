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
                {/* Mobile logo */}
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

      if (error && !/duplicate/i.test(error.message ?? "")) {
        console.error("Register error:", error);
        setLoading(false);
        return toast.error("Registration failed. Please try again.");
      }
    }

    setLoading(false);
    toast.error(
      "Could not generate a unique login number. Please try again.",
    );
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
