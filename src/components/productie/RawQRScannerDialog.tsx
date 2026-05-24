import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Scanner generic QR / Cod de bare care întoarce textul brut decodat.
 * Spre deosebire de QRScannerDialog (care extrage lot UUID), aici primim
 * orice cod (etichetă materie primă, ambalaj, etc.) folosit pentru
 * trasabilitate.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

const RawQRScannerDialog: React.FC<Props> = ({ open, onOpenChange, onScan }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    startedRef.current = false;
    if (!s) return;
    try { await s.stop(); } catch {}
    try { s.clear(); } catch {}
  }, []);

  const mountNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !open || startedRef.current) return;
      startedRef.current = true;
      setStarting(true);
      setError(null);

      (async () => {
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Browserul nu suportă acces la cameră (necesită HTTPS).");
          }
          const probe = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          probe.getTracks().forEach((t) => t.stop());

          if (!node.id) node.id = `raw-qr-${Math.random().toString(36).slice(2)}`;
          const scanner = new Html5Qrcode(node.id, {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ],
          } as any);
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decoded) => {
              stopScanner().finally(() => {
                onOpenChange(false);
                onScan(decoded);
              });
            },
            () => {}
          );
        } catch (e: any) {
          console.error("[raw-qr-scan] start failed:", e);
          startedRef.current = false;
          let msg = e?.message || "Nu am putut porni camera.";
          if (e?.name === "NotAllowedError") msg = "Acces la cameră blocat.";
          setError(msg);
          toast({ title: "Cameră indisponibilă", description: msg, variant: "destructive" });
        } finally {
          setStarting(false);
        }
      })();
    },
    [open, onScan, onOpenChange, stopScanner]
  );

  useEffect(() => {
    if (!open) stopScanner();
  }, [open, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scanează cod (QR / Bare)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div ref={mountNode} className="w-full aspect-square bg-black/80 rounded-md overflow-hidden" />
          {starting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pornesc camera…
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          <p className="text-xs text-muted-foreground text-center">
            Apropie codul de cameră. Detectarea se face automat.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RawQRScannerDialog;
