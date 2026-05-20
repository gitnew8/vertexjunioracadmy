import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel<T extends Record<string, unknown>>(rows: T[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(title: string, headers: string[], rows: (string | number)[][], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Vertex Junior Academy", 14, 16);
  doc.setFontSize(11);
  doc.text(title, 14, 24);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 30,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [60, 80, 180] },
  });
  doc.save(`${filename}.pdf`);
}
