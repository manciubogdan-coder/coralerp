
import { toast as sonnerToast, type Toast as SonnerToast } from "sonner";

export type ToastProps = SonnerToast & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
};

export type ToastActionElement = React.ReactElement;

export const toast = ({ 
  title, 
  description, 
  variant = "default", 
  ...props 
}: ToastProps) => {
  return sonnerToast(
    <div className="grid gap-1">
      {title && <div className="font-semibold">{title}</div>}
      {description && <div className="text-sm opacity-90">{description}</div>}
    </div>,
    {
      className: variant === "destructive" ? "destructive" : "",
      ...props,
    }
  );
};

export function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss
  };
}
