import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/watermark-material")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            path?: string;
            studentName?: string;
            studentClass?: string;
            rollNumber?: string;
            download?: boolean;
          };
          const path = body.path;
          if (!path) return new Response("Missing path", { status: 400 });

          const name = (body.studentName || "Student").slice(0, 80);
          const klass = (body.studentClass || "").slice(0, 30);
          const roll = (body.rollNumber || "").slice(0, 30);
          const stamp = new Date().toLocaleString();
          const wmLine1 = `${name}${roll ? ` · Roll ${roll}` : ""}${klass ? ` · Class ${klass}` : ""}`;
          const wmLine2 = `Issued ${stamp} · Vertex Junior Academy`;

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const dl = await supabaseAdmin.storage
            .from("study-materials")
            .download(path);
          if (dl.error || !dl.data) {
            return new Response(dl.error?.message || "Not found", {
              status: 404,
            });
          }
          const srcBytes = new Uint8Array(await dl.data.arrayBuffer());
          const lower = path.toLowerCase();
          const isPdf = lower.endsWith(".pdf");
          const isImg = /\.(png|jpe?g|webp)$/i.test(lower);
          if (!isPdf && !isImg) {
            // unsupported for server watermark — return original
            return new Response(srcBytes, {
              status: 200,
              headers: {
                "Content-Type": dl.data.type || "application/octet-stream",
                "Content-Disposition": body.download
                  ? `attachment; filename="${baseName(path)}"`
                  : `inline; filename="${baseName(path)}"`,
              },
            });
          }

          const { PDFDocument, StandardFonts, rgb, degrees } = await import(
            "pdf-lib"
          );

          let pdfDoc: import("pdf-lib").PDFDocument;
          if (isPdf) {
            pdfDoc = await PDFDocument.load(srcBytes, {
              ignoreEncryption: true,
            });
          } else {
            pdfDoc = await PDFDocument.create();
            const img = lower.endsWith(".png")
              ? await pdfDoc.embedPng(srcBytes)
              : await pdfDoc.embedJpg(
                  lower.endsWith(".webp")
                    ? srcBytes // best-effort
                    : srcBytes,
                );
            const page = pdfDoc.addPage([img.width, img.height]);
            page.drawImage(img, {
              x: 0,
              y: 0,
              width: img.width,
              height: img.height,
            });
          }

          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const fontSm = await pdfDoc.embedFont(StandardFonts.Helvetica);

          const pages = pdfDoc.getPages();
          for (const page of pages) {
            const { width, height } = page.getSize();
            const diag = Math.hypot(width, height);
            const size = Math.max(28, Math.min(64, diag / 22));

            // Diagonal big watermark (low opacity)
            const text = wmLine1;
            const textWidth = font.widthOfTextAtSize(text, size);
            page.drawText(text, {
              x: width / 2 - textWidth / 2,
              y: height / 2 - size / 2,
              size,
              font,
              color: rgb(0.85, 0.1, 0.1),
              opacity: 0.18,
              rotate: degrees(-30),
            });

            // Header strip
            const hdrSize = 10;
            page.drawRectangle({
              x: 0,
              y: height - 18,
              width,
              height: 18,
              color: rgb(0, 0, 0),
              opacity: 0.55,
            });
            page.drawText(wmLine1, {
              x: 8,
              y: height - 13,
              size: hdrSize,
              font,
              color: rgb(1, 1, 1),
            });

            // Footer strip
            page.drawRectangle({
              x: 0,
              y: 0,
              width,
              height: 18,
              color: rgb(0, 0, 0),
              opacity: 0.55,
            });
            page.drawText(wmLine2, {
              x: 8,
              y: 5,
              size: hdrSize,
              font: fontSm,
              color: rgb(1, 1, 1),
            });
          }

          const out = await pdfDoc.save();
          const outName = baseName(path).replace(/\.[^.]+$/, "") + "-watermarked.pdf";
          return new Response(out as unknown as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `${body.download ? "attachment" : "inline"}; filename="${outName}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: e?.message || "Watermark failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

function baseName(p: string) {
  return p.split("/").pop() || "file";
}
