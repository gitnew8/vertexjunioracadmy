import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CLASSES, CURRICULUM, type Chapter, type SubjectMap } from "@/lib/curriculum";

export type CustomRow = {
  id: string;
  student_class: string;
  subject: string;
  chapter: string;
  topics: string[];
  added_by_type: string;
  added_by_name: string | null;
  created_at: string;
};

export const CUSTOM_CURRICULUM_KEY = ["custom-curriculum"] as const;

export async function fetchCustomCurriculum(): Promise<CustomRow[]> {
  const { data, error } = await supabase
    .from("custom_curriculum")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as CustomRow[];
}

export type MergedCurriculum = {
  classes: string[];
  subjectsFor: (cls: string) => string[];
  chaptersFor: (cls: string, subject: string) => (Chapter & { custom?: CustomRow })[];
  topicsFor: (cls: string, subject: string, chapter: string) => string[];
  hint: (cls?: string) => string;
};

/** Merge pre-loaded syllabus with school-added rows. */
export function mergeCurriculum(rows: CustomRow[]): MergedCurriculum {
  const map: Record<string, Record<string, (Chapter & { custom?: CustomRow })[]>> = {};
  for (const [cls, subs] of Object.entries(CURRICULUM as Record<string, SubjectMap>)) {
    map[cls] = {};
    for (const [s, chs] of Object.entries(subs)) map[cls][s] = chs.map((c) => ({ ...c }));
  }
  const classes: string[] = [...CLASSES];
  for (const r of rows) {
    if (!map[r.student_class]) map[r.student_class] = {};
    if (!classes.includes(r.student_class)) classes.push(r.student_class);
    if (!r.subject) continue;
    const subj = (map[r.student_class][r.subject] ||= []);
    if (!r.chapter) continue;
    const existing = subj.find((c) => c.name.toLowerCase() === r.chapter.toLowerCase());
    if (existing) {
      existing.topics = Array.from(new Set([...existing.topics, ...r.topics]));
    } else {
      subj.push({ name: r.chapter, topics: r.topics, custom: r });
    }
  }
  const subjectsFor = (cls: string) => Object.keys(map[cls] || {});
  const chaptersFor = (cls: string, s: string) => map[cls]?.[s] || [];
  return {
    classes,
    subjectsFor,
    chaptersFor,
    topicsFor: (cls, s, ch) => chaptersFor(cls, s).find((c) => c.name === ch)?.topics || [],
    hint: (cls) => {
      if (!cls || !map[cls]) return `Available classes: ${classes.join(", ")}`;
      return Object.entries(map[cls])
        .map(([s, chs]) => `${s}: ${chs.map((c) => c.name).join(" | ")}`)
        .join("\n");
    },
  };
}

export function useCurriculum() {
  const q = useQuery({ queryKey: CUSTOM_CURRICULUM_KEY, queryFn: fetchCustomCurriculum });
  return { ...mergeCurriculum(q.data || []), rows: q.data || [], isLoading: q.isLoading, refetch: q.refetch };
}
