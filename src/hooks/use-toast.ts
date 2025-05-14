
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast"
import {
  ToastActionProps,
  toast as sonnerToast,
  useToaster,
} from "sonner"

type ToasterToast = ToastProps & {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  cancel?: ToastActionElement
}

const actionPropsMap: Record<
  string,
  Pick<ToastActionProps, "style" | "className">
> = {
  default: {
    className:
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
  },
  cancel: {
    className:
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-muted bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  },
  destructive: {
    className:
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground ring-offset-background transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  },
}

const useToast = () => {
  return {
    toast: sonnerToast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    useToaster,
  }
}

// Re-export for convenience
function toast(props: ToasterToast) {
  const {
    title,
    description,
    variant = "default",
    action,
    cancel,
    id = `toast-${Date.now()}`, // Generate a unique ID if not provided
    ...rest
  } = props

  return sonnerToast[variant === "destructive" ? "error" : "message"](
    title,
    {
      id,
      description,
      action,
      cancel,
      ...rest,
    }
  )
}

export { toast, useToast }
