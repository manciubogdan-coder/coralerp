
import * as React from "react";
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
  return sonnerToast(title || description || "", {
    className: variant === "destructive" ? "destructive" : "",
    description: title ? description : undefined,
    ...props,
  });
};

export function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss
  };
}
