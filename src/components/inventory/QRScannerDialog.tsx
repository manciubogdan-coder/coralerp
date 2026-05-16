import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-custom-toast";

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLotDetected?: (lotId: string) => void;
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const extractLotId = (raw: string): string | null => {
  if (!raw) return null;
  // Preferă UUID-ul din segmentul /lot/<uuid> (host-ul preview-ului
  // Lovable conține și el un UUID — project id — care nu trebuie folosit).
  const afterLot = raw.match(/\/lot\/([0-9a-f-]{36})/i);
  if (afterLot) return afterLot[1];
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("lot");
    if (idx >= 0 && parts[idx + 1] && UUID_RE.test(parts[idx + 1])) {
      return parts[idx + 1].match(UUID_RE)![0];
    }
    // ultimul UUID din path (evită host-ul)
    const pathMatches = u.pathname.match(new RegExp(UUID_RE, "gi"));
    if (pathMatches && pathMatches.length) return pathMatches[pathMatches.length - 1];
  } catch {}
  // fallback: ultimul UUID din string
  const all = raw.match(new RegExp(UUID_RE, "gi"));
  return all && all.length ? all[all.length - 1] : null;
};

export const QRScannerDialog: React.FC<QRScannerDialogProps> = ({
  open,
  onOpenChange,
  onLotDetected,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    startedRef.current = false;
    if (!s) return;
    try {
      await s.stop();
    } catch {}
    try {
      s.clear();
    } catch {}
  }, []);

  // Callback ref: pornește scanerul DOAR după ce divul este montat în DOM.
  const mountNode = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (!node || !open || startedRef.current) return;
      startedRef.current = true;
      setStarting(true);
      setError(null);

      (async () => {
        try {
          // 1. Cer explicit permisiunea pentru cameră (declanșează prompt-ul
          //    browserului) ca să avem mesaje clare dacă e blocată.
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
              "Browserul nu suportă acces la cameră (necesită HTTPS)."
            );
          }
          const probe = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          // închidem probe-ul — html5-qrcode va deschide propriul stream
          probe.getTracks().forEach((t) => t.stop());

          // html5-qrcode acceptă HTMLElement la runtime, dar typing-ul cere
          // string id → asigurăm un id unic și îl pasăm.
          if (!node.id) node.id = `qr-scanner-${Math.random().toString(36).slice(2)}`;
          const scanner = new Html5Qrcode(node.id, {
            verbose: false,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          } as any);
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decodedText) => {
              const id = extractLotId(decodedText);
              if (!id) return;
              stopScanner().finally(() => {
                onOpenChange(false);
                if (onLotDetected) onLotDetected(id);
                else window.location.assign(`/lot/${id}`);
              });
            },
            () => {}
          );
        } catch (e: any) {
          console.error("[qr-scan] start failed:", e);
          startedRef.current = false;
          const name = e?.name || "";
          let msg = e?.message || "Nu am putut porni camera.";
          if (name === "NotAllowedError" || /permission/i.test(msg)) {
            msg =
              "Acces la cameră blocat. Apasă pe iconița 🔒 din bara de adresă → Camera → Permite, apoi redeschide scanerul.";
          } else if (name === "NotFoundError") {
            msg = "Nu am găsit nicio cameră pe acest dispozitiv.";
          } else if (name === "NotReadableError") {
            msg = "Camera este folosită de altă aplicație.";
          } else if (/secure context|https/i.test(msg)) {
            msg = "Camera necesită HTTPS. Deschide aplicația pe domeniul publicat (https://...).";
          } else if (window.self !== window.top) {
            msg +=
              " Dacă ești în preview-ul Lovable, deschide aplicația într-un tab nou (butonul ↗) — iframe-ul preview-ului poate bloca camera.";
          }
          setError(msg);
          toast({
            title: "Cameră indisponibilă",
            description: msg,
            variant: "destructive",
          });
        } finally {
          setStarting(false);
        }
      })();
    },
    [open, onLotDetected, onOpenChange, stopScanner]
  );

  // Cleanup când se închide dialogul
  useEffect(() => {
    if (!open) {
      stopScanner();
    }
  }, [open, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scanează cod QR lot</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div
            ref={mountNode}
            className="w-full aspect-square bg-black/80 rounded-md overflow-hidden"
          />
          {starting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pornesc camera…
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          <p className="text-xs text-muted-foreground text-center">
            Apropie codul QR de cameră. Detectarea se face automat.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScannerDialog;
