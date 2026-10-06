import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CLASSES,
  CURRICULUM,
  type Chapter,
  type SubjectMap,
} from "@/lib/curriculum";

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

export type SystemRow = {
  id: string;
  student_class: string;
  subject: string;
  chapter: string;
  topics: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/*
 * Keep the old exported key name so existing files
 * do not break.
 */
export const CURRICULUM_KEY = ["curriculum"] as const;
export const CUSTOM_CURRICULUM_KEY = CURRICULUM_KEY;


/* -----------------------------
   School / Student Curriculum
------------------------------ */

export async function fetchCustomCurriculum(): Promise<CustomRow[]> {
  const { data, error } = await supabase
    .from("custom_curriculum")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []) as CustomRow[];
}


/* -----------------------------
   System Curriculum
------------------------------ */

export async function fetchSystemCurriculum(): Promise<SystemRow[]> {
  const { data, error } = await supabase
    .from("system_curriculum")
    .select("*")
    .eq("is_active", true)
    .order("student_class", { ascending: true })
    .order("subject", { ascending: true })
    .order("chapter", { ascending: true });

  if (error) throw error;

  return (data || []) as SystemRow[];
}


/* -----------------------------
   Final merged curriculum
------------------------------ */

export type MergedChapter = Chapter & {
  source?: "system" | "default" | "school";
  custom?: CustomRow;
  system?: SystemRow;
};

export type MergedCurriculum = {
  classes: string[];

  subjectsFor: (cls: string) => string[];

  chaptersFor: (
    cls: string,
    subject: string,
  ) => MergedChapter[];

  topicsFor: (
    cls: string,
    subject: string,
    chapter: string,
  ) => string[];

  hint: (cls?: string) => string;
};


/**
 * Build curriculum from:
 *
 * 1. System DB syllabus
 * 2. School/student custom syllabus
 * 3. Existing hard-coded syllabus as fallback
 *
 * IMPORTANT:
 * School custom chapters are NOT merged silently
 * into system/default chapters.
 */
export function mergeCurriculum(
  customRows: CustomRow[] = [],
  systemRows: SystemRow[] = [],
): MergedCurriculum {
  const map: Record<
    string,
    Record<string, MergedChapter[]>
  > = {};

  /* --------------------------------
     1. Start with existing default syllabus
  --------------------------------- */

  for (const [cls, subs] of Object.entries(
    CURRICULUM as Record<string, SubjectMap>,
  )) {
    map[cls] = {};

    for (const [subject, chapters] of Object.entries(subs)) {
      map[cls][subject] = chapters.map((chapter) => ({
        ...chapter,
        source: "default",
      }));
    }
  }


  /* --------------------------------
     2. System DB syllabus
     
     If a system chapter exists, it replaces
     the default chapter with the same
     class + subject + chapter.
  --------------------------------- */

  for (const row of systemRows) {
    if (!row.student_class || !row.subject || !row.chapter) {
      continue;
    }

    if (!map[row.student_class]) {
      map[row.student_class] = {};
    }

    if (!map[row.student_class][row.subject]) {
      map[row.student_class][row.subject] = [];
    }

    const chapters = map[row.student_class][row.subject];

    const existingIndex = chapters.findIndex(
      (chapter) =>
        chapter.name.trim().toLowerCase() ===
        row.chapter.trim().toLowerCase(),
    );

    const systemChapter: MergedChapter = {
      name: row.chapter,
      topics: row.topics || [],
      source: "system",
      system: row,
    };

    if (existingIndex >= 0) {
      chapters[existingIndex] = systemChapter;
    } else {
      chapters.push(systemChapter);
    }
  }


  /* --------------------------------
     3. School / Student custom syllabus
     
     Always kept separate.
  --------------------------------- */

  for (const row of customRows) {
    if (!row.student_class || !row.subject || !row.chapter) {
      continue;
    }

    if (!map[row.student_class]) {
      map[row.student_class] = {};
    }

    if (!map[row.student_class][row.subject]) {
      map[row.student_class][row.subject] = [];
    }

    const chapters = map[row.student_class][row.subject];

    /*
     * Do not merge custom topics into existing
     * system/default chapter.
     *
     * Instead, show it as its own school chapter.
     */
    const customChapter: MergedChapter = {
      name: row.chapter,
      topics: row.topics || [],
      source: "school",
      custom: row,
    };

    chapters.push(customChapter);
  }


  /* --------------------------------
     Classes
  --------------------------------- */

  const classes: string[] = [...CLASSES];

  for (const cls of Object.keys(map)) {
    if (!classes.includes(cls)) {
      classes.push(cls);
    }
  }


  /* --------------------------------
     Helpers
  --------------------------------- */

  const subjectsFor = (cls: string): string[] => {
    return Object.keys(map[cls] || {});
  };


  const chaptersFor = (
    cls: string,
    subject: string,
  ): MergedChapter[] => {
    return map[cls]?.[subject] || [];
  };


  const topicsFor = (
    cls: string,
    subject: string,
    chapter: string,
  ): string[] => {
    const found = chaptersFor(cls, subject).find(
      (item) =>
        item.name.trim().toLowerCase() ===
        chapter.trim().toLowerCase(),
    );

    return found?.topics || [];
  };


  const hint = (cls?: string): string => {
    if (!cls || !map[cls]) {
      return `Available classes: ${classes.join(", ")}`;
    }

    return Object.entries(map[cls])
      .map(
        ([subject, chapters]) =>
          `${subject}: ${chapters
            .map((chapter) => chapter.name)
            .join(" | ")}`,
      )
      .join("\n");
  };


  return {
    classes,
    subjectsFor,
    chaptersFor,
    topicsFor,
    hint,
  };
}


/* -----------------------------
   React Hook
------------------------------ */

export function useCurriculum() {
  const query = useQuery({
    queryKey: CURRICULUM_KEY,

    queryFn: async () => {
      const [systemRows, customRows] = await Promise.all([
        fetchSystemCurriculum(),
        fetchCustomCurriculum(),
      ]);

      return {
        systemRows,
        customRows,
      };
    },
  });

  const systemRows = query.data?.systemRows || [];
  const customRows = query.data?.customRows || [];

  return {
    ...mergeCurriculum(customRows, systemRows),

    rows: customRows,

    customRows,

    systemRows,

    isLoading: query.isLoading,

    refetch: query.refetch,
  };
}
