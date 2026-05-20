import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportRow } from "./types";

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, ...dims };
  } catch {
    return null;
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export async function generateReportPdf(r: ReportRow, mode: "open" | "download" = "download") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Header
  let headerBottom = margin + 60;
  if (r.logo_url) {
    const img = await loadImage(r.logo_url);
    if (img) {
      const maxH = 56;
      const ratio = img.w / img.h;
      const h = maxH;
      const w = h * ratio;
      try { doc.addImage(img.data, "PNG", margin, margin, w, h); } catch {}
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 84);
  doc.text(r.coaching_name, pageW - margin, margin + 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text("Weekly Progress Report", pageW - margin, margin + 36, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Week: ${fmtDate(r.week_start)} – ${fmtDate(r.week_end)}`, pageW - margin, margin + 52, { align: "right" });

  doc.setDrawColor(220);
  doc.line(margin, headerBottom + 4, pageW - margin, headerBottom + 4);

  // Student details
  let y = headerBottom + 26;
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont("helvetica", "bold");
  doc.text("Student", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(r.student_name, margin + 70, y);

  doc.setFont("helvetica", "bold");
  doc.text("Class", margin + 250, y);
  doc.setFont("helvetica", "normal");
  doc.text(r.student_class, margin + 295, y);

  doc.setFont("helvetica", "bold");
  doc.text("Roll No.", margin + 400, y);
  doc.setFont("helvetica", "normal");
  doc.text(r.roll_number, margin + 450, y);

  y += 22;

  // Subjects table
  autoTable(doc, {
    startY: y,
    head: [["Subject", "Topics Covered", "Performance", "Homework", "Remarks"]],
    body: r.subjects.map((s) => [s.name, s.topics, s.performance, s.homework, s.remarks]),
    styles: { fontSize: 9, cellPadding: 6, valign: "top", textColor: 40 },
    headStyles: { fillColor: [69, 84, 168], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 140 },
      2: { cellWidth: 70 },
      3: { cellWidth: 60 },
      4: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  // Watermark
  doc.setFontSize(60);
  doc.setTextColor(230, 230, 230);
  doc.text(r.student_name, pageW / 2, pageH / 2, { align: "center", angle: 30 });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120);
  const footerY = pageH - 40;
  if (r.teacher_name) doc.text(`Teacher: ${r.teacher_name}`, margin, footerY);
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    pageW - margin,
    footerY,
    { align: "right" },
  );
  doc.text("This is a system-generated report.", pageW / 2, footerY + 14, { align: "center" });

  const filename = `${r.student_name.replace(/\s+/g, "_")}_Week_${r.week_start}.pdf`;
  if (mode === "download") {
    doc.save(filename);
  } else {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}
