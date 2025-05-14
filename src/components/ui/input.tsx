
import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "warning";
  preventMobileKeyboardDismiss?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", type, preventMobileKeyboardDismiss, ...props }, ref) => {
    // Apply special handling for mobile keyboard dismissal prevention
    React.useEffect(() => {
      if (preventMobileKeyboardDismiss && type !== "file") {
        // Prevent scroll events from dismissing keyboard
        const handleTouchMove = (e: TouchEvent) => {
          if (document.activeElement?.tagName === 'INPUT') {
            e.stopPropagation();
          }
        };
        
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => {
          document.removeEventListener('touchmove', handleTouchMove);
        };
      }
    }, [preventMobileKeyboardDismiss, type]);
    
    const variantClassNames = {
      default: "border-input",
      warning: "border-amber-400 focus-visible:ring-amber-400"
    };
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          variantClassNames[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
