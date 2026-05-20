import jsPDF from "jspdf";

export type ReceiptData = {
  receipt_no: string;
  payment_date: string;
  paid_month: string;
  amount: number;
  due_amount?: number;
  payment_method: string;
  status: string;
  student_name: string;
  student_class: string;
  course?: string | null;
  institute_name?: string;
};

function fmtINR(n: number) {
  return "Rs. " + Number(n).toLocaleString("en-IN");
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function generateReceiptPdf(r: ReceiptData, mode: "open" | "download" = "download") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const institute = r.institute_name || "Vertex Junior Academy";

  // Top accent bar
  doc.setFillColor(69, 84, 168);
  doc.rect(0, 0, pageW, 70, "F");

  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(institute, margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Fee Payment Receipt", margin, 58);

  // Receipt no badge (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(r.receipt_no, pageW - margin, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(fmtDate(r.payment_date), pageW - margin, 56, { align: "right" });

  // Status pill
  let y = 110;
  const paid = r.status === "paid";
  doc.setFillColor(paid ? 220 : 254, paid ? 252 : 226, paid ? 231 : 226);
  doc.setDrawColor(paid ? 34 : 220, paid ? 197 : 38, paid ? 94 : 38);
  doc.roundedRect(margin, y - 18, 90, 24, 12, 12, "FD");
  doc.setTextColor(paid ? 21 : 153, paid ? 128 : 27, paid ? 61 : 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(paid ? "PAID" : "PENDING", margin + 45, y - 2, { align: "center" });

  // Student details box
  y += 20;
  doc.setDrawColor(220);
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(margin, y, pageW - margin * 2, 90, 8, 8, "FD");

  doc.setTextColor(80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("STUDENT", margin + 16, y + 22);
  doc.text("CLASS", margin + 230, y + 22);
  doc.text("COURSE", margin + 360, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text(r.student_name, margin + 16, y + 42);
  doc.text(r.student_class, margin + 230, y + 42);
  doc.text(r.course || "—", margin + 360, y + 42);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.setFontSize(10);
  doc.text("PAID FOR", margin + 16, y + 66);
  doc.text("METHOD", margin + 230, y + 66);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text(r.paid_month, margin + 16, y + 84);
  doc.text(r.payment_method.toUpperCase(), margin + 230, y + 84);

  // Amount panel
  y += 110;
  doc.setFillColor(69, 84, 168);
  doc.roundedRect(margin, y, pageW - margin * 2, 80, 8, 8, "F");
  doc.setTextColor(220, 225, 250);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("AMOUNT PAID", margin + 20, y + 28);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(fmtINR(r.amount), margin + 20, y + 60);

  if (typeof r.due_amount === "number" && r.due_amount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(255, 220, 220);
    doc.text("Outstanding due", pageW - margin - 20, y + 28, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255);
    doc.text(fmtINR(r.due_amount), pageW - margin - 20, y + 56, { align: "right" });
  }

  // Signature
  y = pageH - 140;
  doc.setDrawColor(180);
  doc.line(pageW - margin - 180, y, pageW - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Authorized Signature / Stamp", pageW - margin - 90, y + 16, { align: "center" });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text("This is a system-generated receipt.", pageW / 2, pageH - 40, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, pageH - 26, { align: "center" });

  const filename = `${r.receipt_no}_${r.student_name.replace(/\s+/g, "_")}.pdf`;
  if (mode === "download") doc.save(filename);
  else window.open(URL.createObjectURL(doc.output("blob")), "_blank");
}
