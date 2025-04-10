
import { toast as originalToast, useToast as useOriginalToast } from "@/hooks/use-toast";

type ToastVariant = "default" | "destructive" | "warning";

export function useCustomToast() {
  const { toast: originalToastFn, ...rest } = useOriginalToast();
  
  const toast = ({ 
    variant = "default", 
    ...props 
  }: { 
    variant?: ToastVariant; 
    title?: string; 
    description?: string;
    action?: React.ReactNode;
    [key: string]: any;
  }) => {
    // Map warning variant to default but with custom styling if needed
    const mappedVariant = variant === "warning" ? "default" : variant;
    
    return originalToastFn({
      ...props,
      variant: mappedVariant,
      className: variant === "warning" ? "bg-amber-50 border-amber-300 text-amber-900" : undefined,
    });
  };
  
  return { 
    ...rest, 
    toast 
  };
}

export const toast = (props: { 
  variant?: ToastVariant; 
  title?: string; 
  description?: string;
  action?: React.ReactNode;
  [key: string]: any;
}) => {
  const { variant = "default", ...rest } = props;
  
  // Map warning variant to default but with custom styling
  const mappedVariant = variant === "warning" ? "default" : variant;
  
  return originalToast({
    ...rest,
    variant: mappedVariant,
    className: variant === "warning" ? "bg-amber-50 border-amber-300 text-amber-900" : undefined,
  });
};
