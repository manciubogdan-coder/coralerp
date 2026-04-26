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
      <AlertDialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-2 border-yellow-500/60">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b-2 border-yellow-500/60 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl font-bold text-yellow-900 dark:text-yellow-100">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              {title}
            </AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-base text-yellow-900/80 dark:text-yellow-100/80 mt-2">
                {description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
        </div>

        <div className="p-6">
          {children}
        </div>

        <AlertDialogFooter className="p-6 pt-0 gap-3 sm:gap-3 flex-col-reverse sm:flex-row sm:justify-between">
          <AlertDialogCancel
            disabled={isSubmitting}
            className="h-14 text-base font-semibold sm:min-w-[180px] mt-0"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-14 text-base font-bold sm:min-w-[220px] bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-5 w-5 mr-2" />
            {isSubmitting ? "Se salvează..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
