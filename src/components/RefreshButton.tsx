import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOperatorT } from "@/lib/operatorI18n";

interface RefreshButtonProps {
  className?: string;
  /** Arată "Actualizat HH:MM" lângă buton după o reîncărcare reușită. */
  showTime?: boolean;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "secondary" | "ghost";
}

const hhmm = (d: Date) =>
  d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

export function RefreshButton({
  className = "",
  showTime = true,
  size = "sm",
  variant = "outline",
}: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const { t } = useOperatorT();
  const [busy, setBusy] = useState(false);
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Marchează toate listele deschise ca fiind vechi și le reîncarcă acum.
      await queryClient.invalidateQueries({ refetchType: "active" });
      if (mounted.current) setLastAt(new Date());
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={run}
        disabled={busy}
        title={t("refresh")}
        className="shrink-0"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""} ${size === "icon" ? "" : "mr-1.5"}`} />
        {size !== "icon" && (busy ? t("refreshing") : t("refresh"))}
      </Button>
      {showTime && lastAt && !busy && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {t("updated", { time: hhmm(lastAt) })}
        </span>
      )}
    </div>
  );
}

export default RefreshButton;
