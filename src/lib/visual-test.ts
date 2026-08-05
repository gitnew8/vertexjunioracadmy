import { supabase } from "@/integrations/supabase/client";

export const VISUAL_BUCKET = "visual-papers";

export type VisualPage = {
  path: string;
  width: number;
  height: number;
};

export type VisualQuestionType =
  | "count_choose"
  | "click_picture"
  | "click_number"
  | "tick_box"
  | "tick_less"
  | "tick_more"
  | "match"
  | "drag_drop"
  | "missing_number"
  | "alphabet"
  | "shapes"
  | "colours"
  | "fruits"
  | "animals"
  | "body_parts"
  | "rhyming"
  | "opposites"
  | "evs";

export const QUESTION_TYPES: { value: VisualQuestionType; label: string }[] = [
  { value: "count_choose", label: "Count & Choose" },
  { value: "click_picture", label: "Click Correct Picture" },
  { value: "click_number", label: "Click Correct Number" },
  { value: "tick_box", label: "Tick Correct Box" },
  { value: "tick_less", label: "Tick Less Objects" },
  { value: "tick_more", label: "Tick More Objects" },
  { value: "match", label: "Match Objects" },
  { value: "drag_drop", label: "Drag & Drop" },
  { value: "missing_number", label: "Missing Number" },
  { value: "alphabet", label: "Alphabet" },
  { value: "shapes", label: "Shapes" },
  { value: "colours", label: "Colours" },
  { value: "fruits", label: "Fruits" },
  { value: "animals", label: "Animals" },
  { value: "body_parts", label: "Body Parts" },
  { value: "rhyming", label: "Rhyming" },
  { value: "opposites", label: "Opposites" },
  { value: "evs", label: "EVS" },
];

export type VisualQuestion = {
  key: string;
  no: number;
  page_index: number;
  type: VisualQuestionType;
  prompt: string;
  topic: string;
};

export type Hotspot = {
  id: string;
  paper_id: string;
  page_index: number;
  group_key: string;
  /** tap = tappable answer option, drag = draggable object, target = drop zone */
  kind: "tap" | "drag" | "target";
  label: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  is_correct: boolean;
  match_key: string | null;
  sort_order: number;
};

export type VisualPaper = {
  id: string;
  title: string;
  student_class: string;
  subject: string;
  instructions: string | null;
  pages: VisualPage[];
  questions: VisualQuestion[];
  status: "draft" | "published";
  created_at: string;
};

/** Signed URLs for private bucket page images. */
export async function signPages(pages: VisualPage[]): Promise<string[]> {
  if (!pages.length) return [];
  const { data } = await supabase.storage
    .from(VISUAL_BUCKET)
    .createSignedUrls(
      pages.map((p) => p.path),
      60 * 60 * 6,
    );
  return pages.map((p, i) => data?.[i]?.signedUrl || "");
}

/* ---------------------------------- TTS ---------------------------------- */

let voicesReady = false;
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (!voices.length) return null;
  return (
    voices.find((v) => /en-IN/i.test(v.lang)) ||
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text.trim()) return;
  if (!voicesReady) {
    window.speechSynthesis.getVoices();
    voicesReady = true;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 0.85;
  u.pitch = opts.pitch ?? 1.2;
  u.volume = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export const PRAISE = ["Excellent!", "Very good!", "Awesome!", "Well done!", "Superb!"];
export const RETRY = ["Oops! Try again.", "Not this one. Try again.", "Almost! Try again."];

export function randomOf(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

/* --------------------------------- Grading -------------------------------- */

export function gradeOf(pct: number) {
  if (pct >= 85) return "A";
  if (pct >= 70) return "B";
  if (pct >= 50) return "C";
  return "D";
}

export function performanceOf(pct: number) {
  if (pct >= 85) return "Outstanding";
  if (pct >= 70) return "Very Good";
  if (pct >= 50) return "Good";
  return "Needs Practice";
}

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
