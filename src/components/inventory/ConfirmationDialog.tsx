import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Check, ArrowLeft } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  children: React.ReactNode;
}

/**
 * Card mare de confirmare înainte de salvare.
 * Forțează operatorul să citească ce urmează să trimită în sistem,
 * pentru a reduce erorile cauzate de vâlva din depozit.
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "CONFIRM și salvez",
  cancelLabel = "Modific",
  isSubmitting = false,
  children,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="
          p-0 border-2 border-yellow-500/60 gap-0
          max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0
          max-sm:w-screen max-sm:max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh]
          max-sm:rounded-none max-sm:border-0
          sm:max-w-2xl sm:w-[95vw] sm:max-h-[90vh]
          flex flex-col overflow-hidden
        "
      >
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b-2 border-yellow-500/60 p-4 sm:p-6 shrink-0">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-yellow-900 dark:text-yellow-100">
              <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-600 shrink-0" />
              <span className="leading-tight">{title}</span>
            </AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-sm sm:text-base text-yellow-900/80 dark:text-yellow-100/80 mt-2">
                {description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        <AlertDialogFooter className="p-4 sm:p-6 pt-3 sm:pt-0 gap-2 sm:gap-3 flex-col-reverse sm:flex-row sm:justify-between border-t bg-background shrink-0">
          <AlertDialogCancel
            disabled={isSubmitting}
            className="h-12 sm:h-14 text-base font-semibold sm:min-w-[180px] mt-0"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-12 sm:h-14 text-base font-bold sm:min-w-[220px] bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-5 w-5 mr-2" />
            {isSubmitting ? "Se salvează..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
