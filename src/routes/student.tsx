{!hydrated ? (
  <main className="min-h-[calc(100vh-80px)] flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">
      Loading...
    </div>
  </main>
) : session ? (
  <StudentReports session={session} />
) : (
  <main className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8 sm:py-12">
    <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border bg-card shadow-2xl lg:grid-cols-2">

      {/* LEFT — Illustration / Welcome */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-indigo-700 p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        
        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/10" />

        <div className="relative z-10">
          <div className="mb-6 inline-flex rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            🎓 Student Portal
          </div>

          <h2 className="max-w-md text-4xl font-extrabold leading-tight">
            Learn. Practice.
            <br />
            <span className="text-yellow-300">Grow.</span>
          </h2>

          <p className="mt-4 max-w-md text-primary-foreground/80">
            Access your weekly reports, tests, study materials,
            fees and academic progress from one place.
          </p>
        </div>

        {/* PNG Illustration */}
        <div className="relative z-10 flex justify-center py-8">
          <img
            src="/images/student-login.png"
            alt="Student"
            className="h-64 w-auto object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/70">
          Powered by Vertex Junior Academy
        </div>
      </div>

      {/* RIGHT — Login / Register */}
      <div className="flex items-center p-5 sm:p-8 lg:p-12">
        <div className="mx-auto w-full max-w-md">

          {/* Mobile heading */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
              🎓
            </div>

            <h1 className="text-2xl font-bold">
              Student Portal
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Vertex Junior Academy
            </p>
          </div>

          {/* Animated Login/Register Switch */}
          <div className="relative mb-8 grid grid-cols-2 rounded-2xl bg-muted p-1.5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`relative z-10 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                mode === "login"
                  ? "bg-background text-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => setMode("register")}
              className={`relative z-10 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                mode === "register"
                  ? "bg-background text-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form Card */}
          <div
            key={mode}
            className="animate-in fade-in slide-in-from-bottom-3 duration-500"
          >
            {mode === "login" ? (
              <div>
                <div className="mb-7">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Lock className="h-7 w-7 text-primary" />
                  </div>

                  <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back!
                  </h1>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Login using your 6-digit student login number.
                  </p>
                </div>

                <LoginForm onSuccess={persist} />
              </div>
            ) : (
              <div>
                <div className="mb-7">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <UserPlus className="h-7 w-7 text-primary" />
                  </div>

                  <h1 className="text-3xl font-bold tracking-tight">
                    Create account
                  </h1>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Register once and get your student login number.
                  </p>
                </div>

                <RegisterForm onLoginAfter={persist} />
              </div>
            )}
          </div>

          {/* Bottom info */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Secure Student Portal
          </div>
        </div>
      </div>
    </div>
  </main>
)}
