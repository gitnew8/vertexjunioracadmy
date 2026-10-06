/**
 * Single source of truth for all homepage content.
 * Swap this module for a CMS fetch later — the page renders purely from it.
 */

export const site = {
  name: "Vertex Junior Academy",
  domain: "https://vertexjunioracadmy.lovable.app",
  tagline: "India's Smart School & Coaching Management Platform",
  subtitle:
    "Online Tests, AI Study Materials, Student Progress Reports, Attendance, Rank Lists, Homework, Parent Portal and PDF Report Cards — all in one platform.",
  email: "hello@vertexjunioracademy.in",
  phone: "+91 90000 00000",
  address: "Vertex Junior Academy, India",
};

export type Feature = { title: string; body: string; icon: string };

export const features: Feature[] = [
  { icon: "Sparkles", title: "AI Study Material", body: "Generate class-wise notes, summaries and revision sheets in seconds — watermarked for every student." },
  { icon: "ClipboardCheck", title: "Online Tests", body: "Timed MCQ and subjective tests with anti-cheating, auto-evaluation and instant results." },
  { icon: "CalendarCheck", title: "Attendance", body: "Daily and live-class attendance marked automatically, with monthly summaries for parents." },
  { icon: "LineChart", title: "Student Progress Reports", body: "Subject-wise weekly reports capturing topics, performance, homework and teacher remarks." },
  { icon: "Trophy", title: "Rank List", body: "Live leaderboards and exam rank lists ranked by average score, accuracy and consistency." },
  { icon: "Users", title: "Parent Portal", body: "A private link for parents to follow tests, reports, attendance and reading practice." },
  { icon: "FileQuestion", title: "AI Question Paper Generator", body: "Board-pattern question papers by class, chapter and difficulty — ready to print." },
  { icon: "BookOpen", title: "Homework", body: "Assign, collect and track homework with reminders and completion status per student." },
  { icon: "FileText", title: "PDF Report Cards", body: "Beautiful, school-branded report cards exported as PDF in one tap." },
  { icon: "BarChart3", title: "Student Analytics", body: "Strength and weakness mapping, topic accuracy, time analysis and exam readiness." },
];

export const whyUs = [
  { title: "Built for Indian classrooms", body: "Hindi and English support, board-aligned patterns and class-wise leniency from Class 1 upwards." },
  { title: "AI that saves teacher hours", body: "Papers, evaluation, reading analysis and report writing handled automatically." },
  { title: "Parents always in the loop", body: "No app installs, no passwords — one private link keeps families updated." },
  { title: "Works on any device", body: "Fast on low-end Android phones, tablets and desktops, even on weak networks." },
];

export const steps = [
  { title: "Set up your school", body: "Add classes, subjects and students once. Import is quick and guided." },
  { title: "Teach and assess", body: "Run online tests, share AI study material, take live classes and mark attendance." },
  { title: "Share the results", body: "Progress reports, rank lists and PDF report cards go out to parents instantly." },
];

export const testimonials = [
  { quote: "Weekly reports that used to take our teachers an entire Saturday now go out in twenty minutes.", name: "Principal, CBSE school", role: "Uttar Pradesh" },
  { quote: "The AI question paper generator matches our exam pattern closely. We print straight from it.", name: "Senior Teacher", role: "Coaching institute, Bihar" },
  { quote: "As a parent I finally know what my daughter studied each week without calling the school.", name: "Parent of a Class VI student", role: "Delhi NCR" },
];

export const faqs = [
  { q: "Do parents need to create an account?", a: "No. Parents open a private read-only link to view reports, rank lists and recordings, and download the PDF report card." },
  { q: "Can it handle online tests without cheating?", a: "Yes. Tests run in full-screen with tab-switch detection, question randomisation and periodic camera snapshots, with a risk score for teachers." },
  { q: "Does the AI work in Hindi?", a: "Yes. Study material, reading analysis and question papers support Hindi and English, and the reading module accepts Hinglish speech." },
  { q: "How many students can one class hold?", a: "Live classes and tests are built to scale to hundreds of concurrent students per class." },
  { q: "Can we export data?", a: "Report cards and rank lists export as PDF, and leaderboards and results export as CSV." },
];
