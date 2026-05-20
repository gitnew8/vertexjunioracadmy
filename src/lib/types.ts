export type Performance = "Good" | "Average" | "Needs Improvement";
export type Homework = "Completed" | "Incomplete";

export interface SubjectEntry {
  name: string;
  topics: string;
  performance: Performance;
  homework: Homework;
  remarks: string;
}

export interface ReportRow {
  id: string;
  code: string;
  coaching_name: string;
  logo_url: string | null;
  week_start: string;
  week_end: string;
  student_name: string;
  student_class: string;
  roll_number: string;
  teacher_name: string | null;
  subjects: SubjectEntry[];
  expires_at: string | null;
  created_at: string;
}
