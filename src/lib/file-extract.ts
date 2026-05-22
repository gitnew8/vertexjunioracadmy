// Client-side file → text extractor for the AI Study Helper.
// Supports: txt/md/csv, pdf (via pdfjs-dist), docx (via mammoth).
// Images are handled separately as base64 image_url.

import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker URL
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite ?url import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker as string;

export type ExtractResult = {
  name: string;
  text: string;
  pages?: number;
};

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    file.type.startsWith("text/")
  ) {
    const text = await file.text();
    return { name, text };
  }

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .filter(Boolean);
      full += `\n\n--- Page ${i} ---\n` + strings.join(" ");
    }
    return { name, text: full.trim(), pages: pdf.numPages };
  }

  if (
    lower.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { name, text: value };
  }

  // PPT / DOC and unknown: not supported here
  throw new Error(
    `Sorry, I can't read "${name}" directly. Please upload a PDF, DOCX, or TXT file. For images, use the photo upload button.`
  );
}

export function fileToImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
