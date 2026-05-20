import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExamQuestion = {
  q_no: number;
  section: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
};

export type ExamMeta = {
  title: string;
  student_class: string;
  subject: string;
  chapter?: string | null;
  time_limit_min: number;
  total_marks: number;
};

export function exportTestPaperPDF(meta: ExamMeta, questions: ExamQuestion[], filename: string) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text("Vertex Junior Academy", w / 2, 14, { align: "center" });
  doc.setFontSize(13);
  doc.text(meta.title, w / 2, 22, { align: "center" });
  doc.setFontSize(10);
  doc.text(
    `Class: ${meta.student_class}    Subject: ${meta.subject}${meta.chapter ? `    Chapter: ${meta.chapter}` : ""}`,
    14,
    32,
  );
  doc.text(`Time: ${meta.time_limit_min} min    Max Marks: ${meta.total_marks}`, 14, 38);
  doc.line(14, 41, w - 14, 41);

  let y = 47;
  const bySection = questions.reduce<Record<string, ExamQuestion[]>>((acc, q) => {
    (acc[q.section] = acc[q.section] || []).push(q);
    return acc;
  }, {});

  for (const section of Object.keys(bySection)) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Section: ${section}`, 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;

    for (const q of bySection[section]) {
      const lines = doc.splitTextToSize(`Q${q.q_no}. ${q.question}  [${q.marks}]`, w - 28);
      if (y + lines.length * 5 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.text(lines, 14, y);
      y += lines.length * 5;
      if (q.options) {
        for (const opt of q.options) {
          const ol = doc.splitTextToSize(opt, w - 32);
          if (y + ol.length * 5 > 285) {
            doc.addPage();
            y = 20;
          }
          doc.text(ol, 18, y);
          y += ol.length * 5;
        }
      }
      y += 3;
    }
    y += 3;
  }

  doc.save(`${filename}.pdf`);
}

export function exportAnswerKeyPDF(meta: ExamMeta, questions: ExamQuestion[], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`${meta.title} — Answer Key`, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [["Q", "Section", "Question", "Answer"]],
    body: questions.map((q) => [q.q_no, q.section, q.question, q.correct_answer]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 80, 180] },
  });
  doc.save(`${filename}.pdf`);
}
