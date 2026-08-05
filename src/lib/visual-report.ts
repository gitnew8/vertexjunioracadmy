import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtTime, performanceOf } from "./visual-test";

export type VisualReportMeta = {
  student_name: string;
  student_class: string;
  roll_number: string;
  paper_title: string;
  subject: string;
  date: string;
  correct: number;
  wrong: number;
  total: number;
  percentage: number;
  time_taken_sec: number;
  grade: string;
  strong: string[];
  weak: string[];
  suggestions: string[];
};

function head(doc: jsPDF, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(255, 138, 76);
  doc.rect(0, 0, w, 26, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Vertex Junior Academy", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, w - 14, 16, { align: "right" });
  doc.setTextColor(30);
}

export function downloadParentReportPdf(m: VisualReportMeta) {
  const doc = new jsPDF();
  head(doc, "Parent Report");

  autoTable(doc, {
    startY: 32,
    theme: "grid",
    head: [["Child details", ""]],
    body: [
      ["Name", m.student_name],
      ["Class", m.student_class],
      ["Roll number", m.roll_number || "—"],
      ["Worksheet", m.paper_title],
      ["Subject", m.subject],
      ["Date", m.date],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [255, 138, 76] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Result", ""]],
    body: [
      ["Total activities", String(m.total)],
      ["Correct", String(m.correct)],
      ["Needs practice", String(m.wrong)],
      ["Score", `${m.percentage}%`],
      ["Time taken", fmtTime(m.time_taken_sec)],
      ["Grade", m.grade],
      ["Performance", performanceOf(m.percentage)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [80, 160, 90] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Strong topics", "Weak topics"]],
    body: [
      [m.strong.length ? m.strong.join("\n") : "—", m.weak.length ? m.weak.join("\n") : "—"],
    ],
    styles: { fontSize: 10, cellPadding: 4, valign: "top" },
    headStyles: { fillColor: [60, 80, 180] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Suggestions for parents"]],
    body: m.suggestions.map((s) => [s]),
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [150, 90, 200] },
  });

  doc.save(`ParentReport_${m.student_name.replace(/\s+/g, "_")}.pdf`);
}

export function downloadCertificatePdf(m: VisualReportMeta) {
  const doc = new jsPDF({ orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 250, 240);
  doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(255, 138, 76);
  doc.setLineWidth(4);
  doc.rect(10, 10, w - 20, h - 20);
  doc.setLineWidth(1);
  doc.setDrawColor(255, 196, 120);
  doc.rect(16, 16, w - 32, h - 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 120, 50);
  doc.text("Certificate of Achievement", w / 2, 44, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(90);
  doc.text("This certificate is proudly presented to", w / 2, 62, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(20, 60, 130);
  doc.text(m.student_name, w / 2, 82, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(70);
  doc.text(
    `for completing "${m.paper_title}" (${m.student_class}) with ${m.percentage}% — Grade ${m.grade}`,
    w / 2,
    98,
    { align: "center", maxWidth: w - 60 },
  );

  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(m.date, 40, h - 30);
  doc.text("Vertex Junior Academy", w - 40, h - 30, { align: "right" });
  doc.setDrawColor(180);
  doc.line(w - 100, h - 36, w - 40, h - 36);

  doc.save(`Certificate_${m.student_name.replace(/\s+/g, "_")}.pdf`);
}
