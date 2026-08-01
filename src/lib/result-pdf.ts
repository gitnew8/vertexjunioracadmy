import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ResultPdfMeta = {
  student_name: string;
  roll_number: string;
  student_class: string;
  test_title: string;
  subject: string;
  date: string;
  total_questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  score: number;
  total: number;
  percentage: number;
  accuracy: number;
  time_taken_sec: number;
  grade: string;
  passed: boolean;
  rank?: number | null;
  percentile?: number | null;
};

export type ResultPdfRow = {
  q_no: number;
  question: string;
  your_answer: string;
  correct_answer: string;
  verdict: string;
  marks: string;
};

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function header(doc: jsPDF, meta: ResultPdfMeta, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(35, 45, 110);
  doc.rect(0, 0, w, 26, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Vertex Junior Academy", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, w - 14, 16, { align: "right" });
  doc.setTextColor(30);
}

export function downloadResultPdf(meta: ResultPdfMeta, rows: ResultPdfRow[]) {
  const doc = new jsPDF();
  header(doc, meta, "Examination Result");

  autoTable(doc, {
    startY: 32,
    theme: "grid",
    head: [["Candidate details", ""]],
    body: [
      ["Student name", meta.student_name],
      ["Roll number", meta.roll_number],
      ["Class", meta.student_class],
      ["Subject", meta.subject],
      ["Test", meta.test_title],
      ["Date & time", meta.date],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [60, 80, 180] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y1 = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y1,
    theme: "grid",
    head: [["Performance", ""]],
    body: [
      ["Total questions", String(meta.total_questions)],
      ["Attempted", String(meta.attempted)],
      ["Not attempted", String(meta.total_questions - meta.attempted)],
      ["Correct", String(meta.correct)],
      ["Incorrect", String(meta.incorrect)],
      ["Marks obtained", `${meta.score} / ${meta.total}`],
      ["Percentage", `${meta.percentage}%`],
      ["Accuracy", `${meta.accuracy}%`],
      ["Time taken", fmtTime(meta.time_taken_sec)],
      [
        "Avg time / question",
        meta.total_questions ? `${Math.round(meta.time_taken_sec / meta.total_questions)}s` : "—",
      ],
      ["Grade", meta.grade],
      ["Result", meta.passed ? "PASS" : "FAIL"],
      ["Rank", meta.rank ? `#${meta.rank}` : "—"],
      ["Percentile", meta.percentile != null ? `${meta.percentile}` : "—"],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [60, 80, 180] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  doc.save(`Result_${meta.student_name.replace(/\s+/g, "_")}_${meta.test_title.replace(/\s+/g, "_")}.pdf`);
}

export function downloadAnswerSheetPdf(meta: ResultPdfMeta, rows: ResultPdfRow[]) {
  const doc = new jsPDF();
  header(doc, meta, "Answer Sheet");
  doc.setFontSize(10);
  doc.text(
    `${meta.student_name} · Roll ${meta.roll_number} · Class ${meta.student_class} · ${meta.test_title}`,
    14,
    34,
  );
  autoTable(doc, {
    startY: 40,
    head: [["Q", "Question", "Your answer", "Correct", "Result", "Marks"]],
    body: rows.map((r) => [r.q_no, r.question, r.your_answer, r.correct_answer, r.verdict, r.marks]),
    styles: { fontSize: 8, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [60, 80, 180] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 20 },
      5: { cellWidth: 16 },
    },
  });
  doc.save(`AnswerSheet_${meta.student_name.replace(/\s+/g, "_")}.pdf`);
}
