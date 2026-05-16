import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-custom-toast";

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when a lot id (uuid) is extracted from the scanned QR.
   * If not provided, scanner will navigate to /lot/:id by default.
   */
  onLotDetected?: (lotId: string) => void;
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const extractLotId = (raw: string): string | null => {
  if (!raw) return null;
  // either an URL like ".../lot/<uuid>" or just the uuid
  const m = raw.match(UUID_RE);
  return m ? m[0] : null;
};

export const QRScannerDialog: React.FC<QRScannerDialogProps> = ({
  open,
  onOpenChange,
  onLotDetected,
}) => {
  const elementId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const id = extractLotId(decodedText);
            if (!id) return;
            // stop and emit
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                scanner.clear();
                scannerRef.current = null;
                onOpenChange(false);
                if (onLotDetected) onLotDetected(id);
                else window.location.assign(`/lot/${id}`);
              });
          },
          () => {
            // per-frame errors, ignore
          }
        );
        if (cancelled) {
          await scanner.stop().catch(() => {});
          scanner.clear();
        }
      } catch (e: any) {
        console.error("[qr-scan] start failed:", e);
        setError(
          e?.message ||
            "Nu am putut porni camera. Verifică permisiunile browserului."
        );
        toast({
          title: "Cameră indisponibilă",
          description:
            "Permite accesul la cameră în browser și reîncearcă. Pe iOS este necesar HTTPS.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setStarting(false);
      }
    };
    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {});
        try { s.clear(); } catch {}
        scannerRef.current = null;
      }
    };
  }, [open, onOpenChange, onLotDetected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scanează cod QR lot</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div
            id={elementId}
            className="w-full aspect-square bg-black/80 rounded-md overflow-hidden"
          />
          {starting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pornesc camera…
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Apropie codul QR de cameră. Detectarea se face automat.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScannerDialog;
