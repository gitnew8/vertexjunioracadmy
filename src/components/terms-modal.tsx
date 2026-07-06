import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { getSetting } from "@/lib/rewards";

export function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tc, setTc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const t = await getSetting<string>("terms_and_conditions");
      setTc(t || "No terms configured yet.");
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" /> Terms &amp; Conditions
          </DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          {tc === null ? "Loading…" : tc}
        </div>
      </DialogContent>
    </Dialog>
  );
}
