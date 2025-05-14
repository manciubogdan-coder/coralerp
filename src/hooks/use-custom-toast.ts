
import { toast as originalToast, useToast as useOriginalToast, type ToastProps } from "@/hooks/use-toast";

type ToastVariant = "default" | "destructive";

interface CustomToastProps extends Omit<ToastProps, "variant"> {
  variant?: ToastVariant;
  title?: string;
  description?: string;
}

export function useCustomToast() {
  const { toast: originalToastFn, dismiss } = useOriginalToast();
  
  const toast = (props: CustomToastProps) => {
    return originalToastFn(props);
  };
  
  return { 
    toast,
    dismiss
  };
}

export const toast = (props: CustomToastProps) => {
  return originalToast(props);
};
