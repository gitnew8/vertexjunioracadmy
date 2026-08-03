import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  ClipboardCheck,
  CalendarCheck,
  LineChart,
  Trophy,
  Users,
  FileQuestion,
  BookOpen,
  FileText,
  BarChart3,
  ArrowRight,
  Check,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Menu,
  X,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import vertexLogo from "@/assets/vertex-logo.png.asset.json";
import { site, features, whyUs, steps, testimonials, faqs } from "@/content/site";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  ClipboardCheck,
  CalendarCheck,
  LineChart,
  Trophy,
  Users,
  FileQuestion,
  BookOpen,
  FileText,
  BarChart3,
};

const TITLE = `${site.name} — ${site.tagline}`;

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: site.subtitle },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: site.subtitle },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${site.domain}/` },
      { property: "og:site_name", content: site.name },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: site.subtitle },
    ],
    links: [{ rel: "canonical", href: `${site.domain}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${site.domain}/#organization`,
              name: site.name,
              url: `${site.domain}/`,
              email: site.email,
              telephone: site.phone,
              address: { "@type": "PostalAddress", addressCountry: "IN", streetAddress: site.address },
            },
            {
              "@type": "WebSite",
              "@id": `${site.domain}/#website`,
              url: `${site.domain}/`,
              name: site.name,
              description: site.subtitle,
              publisher: { "@id": `${site.domain}/#organization` },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${site.domain}/` },
                { "@type": "ListItem", position: 2, name: "Rank List", item: `${site.domain}/rank-list.html` },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }),
      },
    ],
  }),
});

const NAV = [
  { label: "Features", href: "#features" },
  { label: "Why us", href: "#why" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img src={vertexLogo.url} alt={`${site.name} logo`} className="size-9 shrink-0 rounded-full object-cover" />
            <span className="truncate font-display text-base font-semibold sm:text-lg">{site.name}</span>
          </Link>

          <div className="flex items-center gap-1">
            <nav className="mr-2 hidden items-center gap-1 lg:flex">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <Link
              to="/student"
              className="hidden rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary sm:inline-flex"
            >
              Student login
            </Link>
            <Link
              to="/teacher"
              className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:inline-flex"
            >
              Admin
            </Link>
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-background px-5 py-3 lg:hidden">
            <nav className="flex flex-col">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
              <Link to="/student" className="rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm font-medium">
                Student login
              </Link>
              <Link to="/teacher" className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground">
                Admin
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Result banner */}
      <a
        href="/rank-list.html"
        target="_blank"
        rel="noopener"
        className="block bg-primary text-primary-foreground transition hover:opacity-95"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-5 py-2.5 text-center text-xs font-medium sm:text-sm">
          <Trophy className="size-4 shrink-0" />
          <span className="min-w-0">Result declared — view the official Rank List</span>
          <ArrowRight className="size-4 shrink-0" />
        </div>
      </a>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(45% 60% at 30% 50%, color-mix(in oklab, var(--primary) 22%, transparent), transparent), radial-gradient(40% 55% at 75% 40%, color-mix(in oklab, var(--accent) 30%, transparent), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 md:pb-24 md:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Trusted by schools and coaching institutes across India
              </span>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] sm:text-5xl md:text-6xl">
                {site.tagline}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {site.subtitle}
              </p>
              <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/student"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-90"
                >
                  Student login <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/teacher"
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-3.5 font-medium transition hover:bg-secondary"
                >
                  Admin login
                </Link>
              </div>
              <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
                {[
                  ["10+", "Modules"],
                  ["2", "Languages"],
                  ["100%", "Web based"],
                  ["0", "Parent logins"],
                ].map(([v, k]) => (
                  <div key={k}>
                    <dt className="font-display text-2xl font-bold sm:text-3xl">{v}</dt>
                    <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{k}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 border-t border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <SectionHead
              eyebrow="Platform"
              title="Everything your institute runs on"
              body="Ten connected modules replacing spreadsheets, WhatsApp groups and printouts."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const Icon = ICONS[f.icon] ?? Sparkles;
                return (
                  <article
                    key={f.title}
                    className="group rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-paper)]"
                  >
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why us */}
        <section id="why" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
              <div>
                <SectionHead
                  align="left"
                  eyebrow="Why us"
                  title={`Why choose ${site.name}`}
                  body="Designed with teachers, tested in real classrooms, priced for Indian institutes."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {whyUs.map((w) => (
                  <div key={w.title} className="rounded-2xl border border-border bg-card p-6">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-4" />
                    </span>
                    <h3 className="mt-4 font-display text-base font-semibold">{w.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 border-y border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <SectionHead eyebrow="How it works" title="Live in three steps" body="Most institutes are up and running the same week." />
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
                  <span className="font-display text-4xl font-bold text-primary/25">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <SectionHead eyebrow="Testimonials" title="What educators say" body="Feedback from schools and coaching institutes using the platform." />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {testimonials.map((t) => (
                <figure key={t.quote} className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                  <blockquote className="flex-1 font-display text-base leading-relaxed">“{t.quote}”</blockquote>
                  <figcaption className="mt-5 border-t border-border pt-4 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">{t.role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-y border-border bg-secondary/30">
          <div className="mx-auto max-w-3xl px-5 py-16 md:py-24">
            <SectionHead eyebrow="FAQ" title="Frequently asked questions" />
            <div className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {faqs.map((f) => (
                <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <div className="overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] md:p-12">
              <div className="grid gap-10 md:grid-cols-2 md:items-center">
                <div>
                  <h2 className="font-display text-3xl font-bold sm:text-4xl">Bring your institute online</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Talk to us about setting up classes, tests and parent reporting for your school or coaching centre.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={`mailto:${site.email}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                    >
                      <Mail className="size-4" /> Email us
                    </a>
                    <a
                      href={`tel:${site.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium transition hover:bg-secondary"
                    >
                      <Phone className="size-4" /> Call
                    </a>
                  </div>
                </div>
                <ul className="space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-words">{site.email}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{site.phone}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{site.address}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <img src={vertexLogo.url} alt="" className="size-8 rounded-full object-cover" />
                <span className="font-display font-semibold">{site.name}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{site.tagline}</p>
            </div>
            <FooterCol
              title="Platform"
              links={[
                { label: "Features", href: "#features" },
                { label: "How it works", href: "#how" },
                { label: "FAQ", href: "#faq" },
              ]}
            />
            <FooterCol
              title="Access"
              links={[
                { label: "Student login", href: "/student" },
                { label: "Admin login", href: "/teacher" },
                { label: "Leaderboard", href: "/leaderboard" },
              ]}
            />
            <FooterCol
              title="Results"
              links={[
                { label: "Rank list", href: "/rank-list.html" },
                { label: "Contact", href: "#contact" },
              ]}
            />
          </div>
          <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{body}</p>}
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
