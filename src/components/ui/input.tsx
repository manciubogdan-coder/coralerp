
import * as React from "react"

import { cn } from "@/lib/utils"

// Extended input interface to include a 'warning' variant
interface InputProps extends React.ComponentProps<"input"> {
  variant?: "default" | "warning";
  preventMobileKeyboardDismiss?: boolean; // Add new prop to prevent keyboard dismissal
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", preventMobileKeyboardDismiss, ...props }, ref) => {
    // Special handling for mobile devices to prevent keyboard dismissal
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (preventMobileKeyboardDismiss) {
        // Prevent the default behavior that might cause keyboard dismissal
        e.preventDefault();
        // Ensure the input remains focused
        setTimeout(() => {
          e.target.focus();
        }, 100);
      }
      
      // Call any original onFocus handler if it exists
      if (props.onFocus) {
        props.onFocus(e);
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          variant === "warning" && "border-amber-300 bg-amber-50 focus-visible:ring-amber-400",
          className
        )}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
